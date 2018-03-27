/* eslint-env qunit */
import document from 'global/document';
import window from 'global/window';
import {getAbsoluteURL} from '../utils/url.js';

/**
 * This function is used to verify if there is a source value on an element.
 * We need this because an empty string source returns `window.location.href` on
 * el.src but does not on el.getAttribute('src'). Furthermore we always want the
 * absolute source and el.getAttribute('src') always returns the source that was
 * passed in, which may be relative. While el.src always returns the absolute
 *
 * @param {Element} el
 *        The html element to get the source for.
 *
 * @return {string}
 *         The absolute url to the source or empty string if there is no source.
 */
const getSrc = (el) => {

  // We use the attribute to check if a source is set because when
  // the source for the element is set to a blank string. The attribute will
  // return '' and the property will return window.location.href.
  if (el.getAttribute('src')) {
    return el.src;
  }

  return '';
};

/**
 * Trigger the custom `sourceset` event on the native element.
 * this will include what we think the currentSrc will be as a detail.
 *
 * @param {HTMLMediaElement} el
 *        The tech element that the `sourcest` should trigger on
 *
 * @param {string} src
 *        The string to trigger as the source
 */
const triggerSourceset = (el, src) => {
  if (typeof src !== 'string') {
    src = '';
  }

  el.dispatchEvent(new window.CustomEvent('sourceset', {detail: {src}}));
};

/**
 * our implementation of a `innerHTML` descriptor for browsers
 * that do not have one
 */
const innerHTMLDescriptorPolyfill = {
  get() {
    return this.cloneNode(true).innerHTML;
  },
  set(v) {
    // remove all current content from inside
    this.innerText = '';

    // make a dummy node to use innerHTML on
    const dummy = document.createElement(this.nodeName.toLowerCase());

    // set innerHTML to the value provided
    dummy.innerHTML = v;

    // make a document fragment to hold the nodes from dummy
    const docFrag = document.createDocumentFragment();

    // copy all of the nodes created by the innerHTML on dummy
    // to the document fragment
    while (dummy.childNodes.length) {
      docFrag.appendChild(dummy.childNodes[0]);
    }

    // now we add all of that html in one by appending the
    // document fragment. This is how innerHTML does it.
    window.Element.prototype.appendChild.call(this, docFrag);

    // then return the result that innerHTML's setter would
    return this.innerHTML;
  },
  enumerable: true,
  configurable: true
};

/**
 * Get the browsers property descriptor for the `innerHTML`
 * property. This will allow us to overwrite it without
 * destroying native functionality.
 *
 * @param {HTMLMediaElement} el
 *        The tech element that should be used to get the descriptor
 *
 * @param {boolean} [forcePolyfill=false]
 *        force the descriptor polyfill to be used, should only be used for tests.
 *
 * @return {Object}
 *          The property descriptor for innerHTML.
 */
const getInnerHTMLDescriptor = (el, forcePolyfill = false) => {
  const proto = window.Element.prototype;
  let descriptor = {};

  // preserve native getters/setters already on `el.innerHTML` if they exist
  if (!forcePolyfill && Object.getOwnPropertyDescriptor(el, 'innerHTML')) {
    descriptor = Object.getOwnPropertyDescriptor(el, 'innerHTML');
  } else if (!forcePolyfill && Object.getOwnPropertyDescriptor(proto, 'innerHTML')) {
    descriptor = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  }

  if (!descriptor.set || !descriptor.get) {
    descriptor = innerHTMLDescriptorPolyfill;
  }

  descriptor.enumerable = descriptor.enumerable || innerHTMLDescriptorPolyfill.enumerable;
  descriptor.configurable = descriptor.configurable || innerHTMLDescriptorPolyfill.configurable;

  return descriptor;
};

/**
 * our implementation of a `src` descriptor for browsers
 * that do not have one
 */
const srcDescriptorPolyfill = {
  get() {
    if (this.src_) {
      return this.src_;
    }

    return '';
  },
  set(v) {
    v = String(v);

    this.src_ = getAbsoluteURL(v);
    window.Element.prototype.setAttribute.call(this, 'src', v);

    return v;
  },
  enumerable: true,
  configurable: true
};

/**
 * First we try to patch the src property just using the native descriptor.
 * If there isn't a native descriptor we have to polyfill a descriptor which
 * means that we also have to overwrite `setAttribute` and `removeAttribute`
 * property as those would be modified by the native descriptor.
 *
 * @param {HTMLMediaElement} el
 *        The tech element that should have its `src` property patched
 *
 * @param {boolean} [forcePolyfill=false]
 *        force the descriptor polyfill to be used, should only be used for tests.
 *
 */
const patchSrcProperty = (el, forcePolyfill = false) => {
  const proto = window.HTMLMediaElement.prototype;
  let descriptor = {};

  // preserve getters/setters already on `el.src` if they exist
  if (!forcePolyfill && Object.getOwnPropertyDescriptor(el, 'src')) {
    descriptor = Object.getOwnPropertyDescriptor(el, 'src');
  } else if (!forcePolyfill && Object.getOwnPropertyDescriptor(proto, 'src')) {
    descriptor = Object.getOwnPropertyDescriptor(proto, 'src');
  }

  if (!descriptor.set || !descriptor.get) {
    descriptor = srcDescriptorPolyfill;

    const oldFn = {setAttribute: el.setAttribute, removeAttribute: el.removeAttribute};

    // these have to be patched for polyfills, because they effect the src property
    el.setAttribute = function(...args) {
      const retval = oldFn.setAttribute.apply(el, args);

      if ((/^src$/i).test(args[0])) {
        el.src_ = getAbsoluteURL(String(args[1]) || '');
      }

      return retval;
    };

    el.removeAttribute = function(...args) {
      const retval = oldFn.removeAttribute.apply(el, args);

      if ((/^src$/i).test(args[0])) {
        el.src_ = '';
      }
      return retval;
    };
  }

  descriptor.enumerable = descriptor.enumerable || srcDescriptorPolyfill.enumerable;
  descriptor.configurable = descriptor.configurable || srcDescriptorPolyfill.configurable;

  Object.defineProperty(el, 'src', Object.assign({}, descriptor, {
    set(...args) {
      const retval = descriptor.set.apply(el, args);

      triggerSourceset(el, getSrc(el));

      return retval;
    }
  }));
};

/**
 * Run a partial source selection algorithm and get the source that should be selected.
 * We return empty string in two cases:
 * 1. There are no sources
 * 2. There is more than one <source> element with different urls
 *
 * if we had a full source selection algorithm we would do #2 but there isn't much benefit.
 *
 * @param {HTMLMediaElement} el
 *        the media element to run source selection on
 *
 * @param {NodeList} [sources]
 *        The list of sources that a children of the HTMLMediaElement.
 *        This should only be passed in if it was needed before source selection.
 *
 * @return {string}
 *          The source that will be selected or empty string if there isn't one or we
 *          don't know what source will be selected.
 */
const runSourceSelection = (el, sources) => {
  if (el.src) {
    return getSrc(el);
  }

  // source are either passed in by a function that uses needs them before us
  // or we need to find them ourselves
  sources = sources || el.getElementsByTagName('source');

  if (sources.length === 0) {
    return '';
  }

  const srcUrls = [];
  let src = null;

  // only count valid/non-duplicate source elements
  for (let i = 0; i < sources.length; i++) {
    // We do not use the property here because the property will
    // return window.location.href when src is set to an empty string
    const url = getSrc(sources[i]);

    if (url && srcUrls.indexOf(url) === -1) {
      srcUrls.push(url);
    }
  }

  // there were no valid sources
  if (!srcUrls.length) {
    return '';
  }

  // there is only one valid source element url
  // use that
  if (srcUrls.length === 1) {
    src = srcUrls[0];
  }

  return src;
};

/**
 * This function patches `append`, `appendChild`, `innerHTML`, and
 * `insertAdjacentHTML` to detect when a source is first added to
 * a media element. Once a source is set, these properties/methods will
 * be set back to their original state.
 *
 * @param {HTMLMediaElement} el
 *        the media element to run source selection on
 *
 * @param {boolean} [forcePolyfill=false]
 *        Force the descriptor polyfills to be used, should only be used for tests.
 */
const watchForFirstSource = function(el, forcePolyfill = false) {

  if (el.watchForFirstSource_) {
    return;
  }

  el.watchForFirstSource_ = true;

  const oldProp = {innerHTML: getInnerHTMLDescriptor(el, forcePolyfill)};
  const oldFn = {};
  const appendWrapper = (appendFn) => (...args) => {
    const retval = appendFn(args);
    const sources = el.getElementsByTagName('source');

    if (sources.length) {
      triggerSourceset(el, runSourceSelection(el, sources));
    }

    return retval;
  };

  // only support functions that have browser support
  ['appendChild', 'append', 'insertAdjacentHTML'].forEach((m) => {
    if (!el[m]) {
      return;
    }
    oldFn[m] = el[m];
  });

  Object.defineProperty(el, 'innerHTML', Object.assign({}, oldProp.innerHTML, {
    set: appendWrapper((args) => oldProp.innerHTML.set.apply(el, args))
  }));

  Object.keys(oldFn).forEach((m) => {
    el[m] = appendWrapper((args) => oldFn[m].apply(el, args));
  });

  const resetOnSourceset = (e) => {
    Object.keys(oldFn).forEach((m) => {
      el[m] = oldFn[m].bind(el);
    });
    Object.defineProperty(el, 'innerHTML', oldProp.innerHTML);

    el.watchForFirstSource_ = false;
    el.removeEventListener('sourceset', resetOnSourceset);
  };

  el.addEventListener('sourceset', resetOnSourceset);
};

/**
 * This function patches `src`, `setAttribute`, and `load` to detect when a source is set on the media element.
 * It will fire a custom event called `sourceset` when  that happens.
 *
 * > NOTE: It will also override the function in listed `watchForFirstSource()` when there
 *         is no source in the media element at first and when their is no source in the
 *         media element on `load()`.
 *
 * > NOTE: This function will also put a minor wrapper around `removeAttribute` when
 *         there is no native descriptor for the `src` property.
 *
 * @param {HTMLMediaElement} el
 *        the media element to add the `sourceset` event to
 *
 * @param {boolean} [forcePolyfill=false]
 *        Force the descriptor polyfills to be used, should only be used for tests.
 *
 * @return {HTMLMediaElement}
 *         the element with `sourceset` added on
 */
const patchSourceset = function(el, forcePolyfill) {
  // only patch sourceset if it hasn'd been done yet
  if (el.patchSourceset_) {
    return;
  }

  el.patchSourceset_ = true;

  // patch the source property, if polyfilled we may have to double
  // overwire the native property to get the correct functionality
  patchSrcProperty(el, forcePolyfill);

  const oldFn = {load: el.load, setAttribute: el.setAttribute};
  const loadLogic = () => {
    const sources = el.getElementsByTagName('source');

    // only trigger sourceset if there is something to load
    if (getSrc(el) || sources.length > 0) {
      triggerSourceset(el, runSourceSelection(el, sources));
    // otherwise watch for the first source append
    } else {
      watchForFirstSource(el, forcePolyfill);
    }
  };

  el.load = function() {
    const retval = oldFn.load.call(el);

    loadLogic();

    return retval;
  };

  el.setAttribute = function(...args) {
    const retval = oldFn.setAttribute.apply(el, args);

    if ((/^src/i).test(args[0])) {
      el.src_ = getAbsoluteURL(String(args[1]) || '');
      triggerSourceset(el, getSrc(el));
    }

    return retval;
  };

  // run the load logic so that we can fire the first sourceset
  // if we were given an el with a source.
  loadLogic();

  return el;
};

export default patchSourceset;
