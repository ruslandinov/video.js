/* eslint-env qunit */
import window from 'global/window';
import document from 'global/document';
import patchSourceset from '../../src/js/tech/patch-sourceset';
import {getAbsoluteURL} from '../../src/js/utils/url.js';

const wait = 20;
const BASE_URL = getAbsoluteURL('l').replace(/l$/, '');
const sourceOne = {src: 'http://example.com/one.mp4', type: 'video/mp4'};
const sourceTwo = {src: 'http://example.com/two.mp4', type: 'video/mp4'};
const relative = {src: 'relative.mp4', type: 'video/mp4'};
const oneExpected = {
  event: sourceOne.src,
  src: sourceOne.src,
  attr: sourceOne.src
};
const twoExpected = {
  event: sourceTwo.src,
  src: sourceTwo.src,
  attr: sourceTwo.src
};
const relativeExpected = {
  event: BASE_URL + relative.src,
  src: BASE_URL + relative.src,
  attr: relative.src
};

const singleTypes = [
  {name: 'src', fn: (el, v) => {el.src = v;}}, // eslint-disable-line
  {name: 'setAttribute', fn: (el, v) => el.setAttribute('src', v)}
];

const appendTypes = [
  {name: 'appendChild', fn: (el, obj) => el.appendChild(obj)},
  {name: 'innerHTML', fn: (el, obj) => {el.innerHTML = el.innerHTML + obj.outerHTML;}}, // eslint-disable-line
];

const watchEvents = ['sourceset', 'loadstart', 'emptied', 'abort', 'reset'];

// ie does not support this and safari < 10 does not either
if (window.Element.prototype.append) {
  appendTypes.push({name: 'append', fn: (el, obj) => el.append(obj)});
}

if (window.Element.prototype.insertAdjacentHTML) {
  appendTypes.push({name: 'insertAdjacentHTML', fn: (el, obj) => el.insertAdjacentHTML('beforeend', obj.outerHTML)});
}

const testTypes = ['video', 'audio', 'video with polyfills', 'audio with polyfills'];

QUnit.module('raw sourceset', () => testTypes.forEach((testType) => QUnit.module(testType, () => {
  const hooks = {
    beforeEach() {
      this.fixture = document.getElementById('qunit-fixture');
      if ((/audio/i).test(testType)) {
        this.el = document.createElement('audio');
      } else {
        this.el = document.createElement('video');
      }

      if ((/polyfill/i).test(testType)) {
        this.el = patchSourceset(this.el, true);
      } else {
        this.el = patchSourceset(this.el);
      }

      this.el.on = this.el.addEventListener;
      this.el.off = this.el.removeEventListener;

      this.events = [];
      this.sourcesetState = [];
      this.loadstartState = [];

      this.el.on('sourceset', (e) => {
        this.sourcesetState.push({
          event: e.detail.src,
          src: this.el.src,
          attr: this.el.getAttribute('src')
        });
      });

      this.el.on('loadstart', (e) => {
        this.loadstartState.push({
          currentSrc: this.el.currentSrc
        });
      });

      watchEvents.forEach((name) => {
        this.el.on(name, (e) => {
          this.events.push(name);
        });
      });
      this.fixture.appendChild(this.el);
    },
    afterEach(assert) {
      const done = assert.async();

      this.el.on('loadstart', (e) => {
        assert.ok(false, 'all loadstarts should be handled');
      });

      this.el.on('loadstart', (e) => {
        assert.ok(false, 'all sourcesets should be handled');
      });

      window.setTimeout(() => {
        done();
      }, wait);
    }
  };

  QUnit.module('single', hooks);
  singleTypes.forEach((s) => {
    QUnit.test(`${s.name} blank`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{event: '', src: window.location.href, attr: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: ''}], 'as expected');
        done();
      });

      s.fn(this.el, '');
    });

    QUnit.test(`${s.name} null`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        const absolute = BASE_URL + 'null';

        assert.deepEqual(this.sourcesetState, [{event: absolute, src: absolute, attr: 'null'}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: BASE_URL + 'null'}], 'as expected');
        done();
      });
      s.fn(this.el, null);
    });

    QUnit.test(`${s.name} valid`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      this.el.src = sourceOne.src;
    });

    QUnit.test(`${s.name} relative`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [relativeExpected], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: BASE_URL + relative.src}], 'as expected');
        done();
      });

      this.el.src = relative.src;
    });
  });

  appendTypes.forEach((a) => {
    QUnit.test(`${a.name} <p>`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.ok(false, 'should not get a loadstart');
      });

      const p = document.createElement('p');

      a.fn(this.el, p);

      window.setTimeout(() => {
        assert.ok('true', 'finished without a  loadstart');
        assert.equal(this.sourcesetState.length, 0, 'no sourcesets');
        assert.equal(this.loadstartState.length, 0, 'no sourcesets');
        done();
      }, wait);
    });

    QUnit.test(`${a.name} <source> no src`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: '', src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: ''}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      a.fn(this.el, source);
    });

    QUnit.test(`${a.name} <source> blank src`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: '', src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: ''}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      source.src = '';

      a.fn(this.el, source);
    });

    QUnit.test(`${a.name} <source> null src`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: '', src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: ''}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      source.src = '';

      a.fn(this.el, source);
    });

    QUnit.test(`${a.name} <source> src prop`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: sourceOne.src, src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      source.src = sourceOne.src;

      a.fn(this.el, source);
    });

    QUnit.test(`${a.name} <source> src attr`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: sourceOne.src, src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      source.setAttribute('src', sourceOne.src);

      a.fn(this.el, source);
    });

    QUnit.test(`${a.name} <source> src relative`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, event: BASE_URL + relative.src, src: ''}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: BASE_URL + relative.src}], 'as expected');
        done();
      });

      const source = document.createElement('source');

      source.setAttribute('src', relative.src);

      a.fn(this.el, source);
    });
  });

  QUnit.test('load', function(assert) {
    const done = assert.async();

    this.el.on('loadstart', () => {
      assert.ok(false, 'should not get a loadstart');
    });

    this.el.load();

    window.setTimeout(() => {
      assert.ok('true', 'finished without a  loadstart');
      assert.equal(this.sourcesetState.length, 0, 'no sourcesets');
      assert.equal(this.loadstartState.length, 0, 'no sourcesets');
      done();
    }, wait);
  });

  QUnit.test('setAttribute with capital SRC', function(assert) {
    const done = assert.async();

    this.el.on('loadstart', () => {
      assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
      assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
      done();
    });

    this.el.setAttribute('SRC', sourceOne.src);
  });

  QUnit.module('sequential', hooks);
  singleTypes.forEach((s1) => {
    singleTypes.forEach((s2) => {
      QUnit.test(`${s1.name} then ${s2.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length < 2) {
            s2.fn(this.el, sourceTwo.src);
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
      });

      QUnit.test(`${s1.name} then ${s2.name} + load`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            s2.fn(this.el, sourceTwo.src);
            return;
          }

          if (this.loadstartState.length === 2) {
            this.el.load();
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
      });

      QUnit.test(`${s1.name} then removeAttribute + ${s2.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length < 2) {
            this.el.removeAttribute('src');
            s2.fn(this.el, sourceTwo.src);
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
      });

      QUnit.test(`${s1.name} then removeAttribute + ${s2.name} + load`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            this.el.removeAttribute('src');
            s2.fn(this.el, sourceTwo.src);
            return;
          }

          if (this.loadstartState.length === 2) {
            this.el.load();
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
      });
    });

    QUnit.test(`${s1.name} then load`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        if (this.loadstartState.length < 2) {
          this.el.load();
          return;
        }
        assert.deepEqual(this.sourcesetState, [oneExpected, oneExpected], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      s1.fn(this.el, sourceOne.src);
    });

    QUnit.test(`${s1.name} then removeAttribute and load`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        if (this.loadstartState.length >= 2) {
          assert.ok(false, 'should not get more than one loadstart');
          return;
        }
        this.el.removeAttribute('src');
        this.el.load();

        window.setTimeout(() => {
          assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        }, wait);
      });

      s1.fn(this.el, sourceOne.src);
    });
  });

  appendTypes.forEach((a1) => {
    singleTypes.forEach((s) => {
      QUnit.test(`${s.name} and then ${a1.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length >= 2) {
            assert.ok(false, 'should not get more than one loadstart');
            return;
          }
          const source = document.createElement('source');

          source.src = sourceTwo.src;

          a1.fn(this.el, source);

          window.setTimeout(() => {
            assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
            assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
            done();
          }, wait);
        });

        s.fn(this.el, sourceOne.src);
      });

      QUnit.test(`${a1.name} and then ${s.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            s.fn(this.el, sourceTwo.src);
            return;
          }

          assert.deepEqual(this.sourcesetState, [{src: '', event: sourceOne.src, attr: null}, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        const source = document.createElement('source');

        source.src = sourceOne.src;

        a1.fn(this.el, source);
      });

      QUnit.test(`${s.name} and then ${a1.name} + load`, function(assert) {
        const done = assert.async();
        const s2 = document.createElement('source');

        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            a1.fn(this.el, s2);
            window.setTimeout(() => {
              this.el.load();
            }, wait);
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, oneExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        this.el.src = sourceOne.src;
      });

      QUnit.test(`${s.name} and then removeAttribute + ${a1.name} + load`, function(assert) {
        const done = assert.async();
        const s2 = document.createElement('source');

        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            this.el.removeAttribute('src');
            a1.fn(this.el, s2);
            window.setTimeout(() => {
              this.el.load();
            }, wait);
            return;
          }

          assert.deepEqual(this.sourcesetState, [oneExpected, {src: '', event: sourceTwo.src, attr: null}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        this.el.src = sourceOne.src;
      });
    });
    // end single

    appendTypes.forEach((a2) => {
      QUnit.test(`${a1.name} and then ${a2.name}`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          if (this.loadstartState.length >= 2) {
            assert.ok(false, 'should not get more than one loadstart');
            return;
          }
          a2.fn(this.el, s2);

          window.setTimeout(() => {
            assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}], 'as expected');
            assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
            done();
          }, wait);
        });

        a1.fn(this.el, s1);
      });

      QUnit.test(`${a1.name} and then ${a2.name} + load`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            a2.fn(this.el, s2);
            window.setTimeout(() => {
              this.el.load();
            }, wait);
            return;
          }

          assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: ''}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        a1.fn(this.el, s1);
      });

      QUnit.test(`${a1.name} and then removeAttribute + ${a2.name} + load`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          if (this.loadstartState.length === 1) {
            this.el.removeAttribute('src');
            a2.fn(this.el, s2);
            window.setTimeout(() => {
              this.el.load();
            }, wait);
            return;
          }

          assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: ''}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        a1.fn(this.el, s1);
      });
    });

    QUnit.test(`${a1.name} and then load`, function(assert) {
      const done = assert.async();

      const s1 = document.createElement('source');

      s1.src = sourceOne.src;

      this.el.on('loadstart', () => {
        if (this.loadstartState.length === 1) {
          this.el.load();
          return;
        }

        assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: sourceOne.src}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}, {currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      a1.fn(this.el, s1);
    });

    QUnit.test(`load and then ${a1.name}`, function(assert) {
      const done = assert.async();

      const s1 = document.createElement('source');

      s1.src = sourceOne.src;

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      this.el.load();

      window.setTimeout(() => {
        assert.deepEqual(this.sourcesetState, [], 'as expected');
        assert.deepEqual(this.loadstartState, [], 'as expected');
        a1.fn(this.el, s1);
      }, wait);
    });
  });

  QUnit.test('load and then load', function(assert) {
    const done = assert.async();

    this.el.on('loadstart', () => {
      assert.ok(false, 'should not get a loadstart');
    });

    this.el.load();
    this.el.load();

    window.setTimeout(() => {
      assert.ok('true', 'finished without a  loadstart');
      assert.equal(this.sourcesetState.length, 0, 'no sourcesets');
      assert.equal(this.loadstartState.length, 0, 'no sourcesets');
      done();
    }, wait);
  });

  QUnit.module('parallel', hooks);

  singleTypes.forEach((s1) => {
    singleTypes.forEach((s2) => {
      QUnit.test(`${s1.name} then ${s2.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
        s2.fn(this.el, sourceTwo.src);
      });

      QUnit.test(`${s1.name} then ${s2.name} + load`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
        s2.fn(this.el, sourceTwo.src);
        this.el.load();
      });

      QUnit.test(`${s1.name} then removeAttribute + ${s2.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        s1.fn(this.el, sourceOne.src);
        this.el.removeAttribute('src');
        s2.fn(this.el, sourceTwo.src);
      });

      QUnit.test(`${s1.name} then removeAttribute + ${s2.name} + load`, function(assert) {
        const done = assert.async();

        window.setTimeout(() => {
          assert.deepEqual(this.sourcesetState, [oneExpected, twoExpected, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        }, wait);

        s1.fn(this.el, sourceOne.src);
        this.el.removeAttribute('src');
        s2.fn(this.el, sourceTwo.src);
        this.el.load();
      });
    });

    QUnit.test(`${s1.name} then load`, function(assert) {
      const done = assert.async();

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [oneExpected, oneExpected], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      s1.fn(this.el, sourceOne.src);
      this.el.load();
    });

    QUnit.test(`${s1.name} then removeAttribute and load`, function(assert) {
      const done = assert.async();

      window.setTimeout(() => {
        assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
        assert.deepEqual(this.loadstartState, [], 'as expected');
        done();
      }, wait);

      s1.fn(this.el, sourceOne.src);
      this.el.removeAttribute('src');
      this.el.load();
    });
  });

  appendTypes.forEach((a1) => {
    singleTypes.forEach((s) => {
      QUnit.test(`${s.name} and then ${a1.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        const source = document.createElement('source');

        source.src = sourceTwo.src;

        s.fn(this.el, sourceOne.src);
        a1.fn(this.el, source);
      });

      QUnit.test(`${a1.name} and then ${s.name}`, function(assert) {
        const done = assert.async();

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [{src: '', attr: null, event: sourceOne.src}, twoExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        const source = document.createElement('source');

        source.src = sourceOne.src;

        a1.fn(this.el, source);
        s.fn(this.el, sourceTwo.src);

      });

      QUnit.test(`${s.name} and then ${a1.name} + load`, function(assert) {
        const done = assert.async();
        const s2 = document.createElement('source');

        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected, oneExpected], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        this.el.src = sourceOne.src;
        a1.fn(this.el, s2);
        this.el.load();
      });

      QUnit.test(`${s.name} and then removeAttribute + ${a1.name} + load`, function(assert) {
        const done = assert.async();
        const s2 = document.createElement('source');

        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [oneExpected, {src: '', event: sourceTwo.src, attr: null}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceTwo.src}], 'as expected');
          done();
        });

        this.el.src = sourceOne.src;
        this.el.removeAttribute('src');
        a1.fn(this.el, s2);
        this.el.load();
      });
    });
    // end single

    appendTypes.forEach((a2) => {
      QUnit.test(`${a1.name} and then ${a2.name}`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        a1.fn(this.el, s1);
        a2.fn(this.el, s2);
      });

      QUnit.test(`${a1.name} and then ${a2.name} + load`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: ''}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        a1.fn(this.el, s1);
        a2.fn(this.el, s2);
        this.el.load();
      });

      QUnit.test(`${a1.name} and then removeAttribute + ${a2.name} + load`, function(assert) {
        const done = assert.async();

        const s1 = document.createElement('source');
        const s2 = document.createElement('source');

        s1.src = sourceOne.src;
        s2.src = sourceTwo.src;

        this.el.on('loadstart', () => {
          assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: ''}], 'as expected');
          assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
          done();
        });

        a1.fn(this.el, s1);
        this.el.removeAttribute('src');
        a2.fn(this.el, s2);
        this.el.load();
      });
    });

    QUnit.test(`${a1.name} and then load`, function(assert) {
      const done = assert.async();

      const s1 = document.createElement('source');

      s1.src = sourceOne.src;

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}, {attr: null, src: '', event: sourceOne.src}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      a1.fn(this.el, s1);
      this.el.load();
    });

    QUnit.test(`load and then ${a1.name}`, function(assert) {
      const done = assert.async();

      const s1 = document.createElement('source');

      s1.src = sourceOne.src;

      this.el.on('loadstart', () => {
        assert.deepEqual(this.sourcesetState, [{attr: null, src: '', event: sourceOne.src}], 'as expected');
        assert.deepEqual(this.loadstartState, [{currentSrc: sourceOne.src}], 'as expected');
        done();
      });

      this.el.load();
      a1.fn(this.el, s1);
    });
  });

  QUnit.test('load and then load', function(assert) {
    const done = assert.async();

    this.el.on('loadstart', () => {
      assert.ok(false, 'should not get a loadstart');
    });

    this.el.load();
    this.el.load();

    window.setTimeout(() => {
      assert.ok('true', 'finished without a  loadstart');
      assert.equal(this.sourcesetState.length, 0, 'no sourcesets');
      assert.equal(this.loadstartState.length, 0, 'no sourcesets');
      done();
    }, wait);
  });
})));
