var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};

// src/sampler/note.ts
function noteNameToMidi(note) {
  const REGEX = /^([a-gA-G]?)(#{1,}|b{1,}|)(-?\d+)$/;
  const m = REGEX.exec(note);
  const letter = m[1].toUpperCase();
  if (!letter)
    return;
  const acc = m[2];
  const alt = acc[0] === "b" ? -acc.length : acc.length;
  const oct = m[3] ? +m[3] : 4;
  const step = (letter.charCodeAt(0) + 3) % 7;
  return [0, 2, 4, 5, 7, 9, 11][step] + alt + 12 * (oct + 1);
}
function toMidi(note) {
  return note === void 0 ? void 0 : typeof note === "number" ? note : typeof note === "string" ? noteNameToMidi(note) : toMidi(note.midi ?? note.name);
}
function midiVelToGain(vel) {
  return vel * vel / 16129;
}

// src/sampler/signals.ts
function createControl(initialValue) {
  let current = initialValue;
  const listeners = /* @__PURE__ */ new Set();
  function subscribe(listener) {
    listeners.add(listener);
    listener(current);
    return () => {
      listeners.delete(listener);
    };
  }
  function set(value) {
    current = value;
    listeners.forEach((listener) => listener(current));
  }
  function get() {
    return current;
  }
  return { subscribe, set, get };
}
function createTrigger() {
  const listeners = /* @__PURE__ */ new Set();
  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  function trigger(value) {
    listeners.forEach((listener) => listener(value));
  }
  return { subscribe, trigger };
}
function unsubscribeAll(unsubscribe) {
  let done = false;
  return () => {
    if (done)
      return;
    done = true;
    unsubscribe.forEach((cb) => cb == null ? void 0 : cb());
  };
}

// src/sampler/connect.ts
function connectSerial(nodes) {
  const _nodes = nodes.filter((x) => !!x);
  _nodes.reduce((a, b) => {
    const left = "output" in a ? a.output : a;
    const right = "input" in b ? b.input : b;
    left.connect(right);
    return b;
  });
  return () => {
    _nodes.reduce((a, b) => {
      const left = "output" in a ? a.output : a;
      const right = "input" in b ? b.input : b;
      left.disconnect(right);
      return b;
    });
  };
}

// src/sampler/channel.ts
var _volume, _sends, _inserts, _disconnect, _unsubscribe, _options;
var Channel = class {
  constructor(context, options) {
    this.context = context;
    __privateAdd(this, _volume, void 0);
    __privateAdd(this, _sends, void 0);
    __privateAdd(this, _inserts, void 0);
    __privateAdd(this, _disconnect, void 0);
    __privateAdd(this, _unsubscribe, void 0);
    __privateAdd(this, _options, void 0);
    __privateSet(this, _options, Object.freeze({
      destination: context.destination,
      volume: 100,
      volumeToGain: midiVelToGain,
      ...options
    }));
    this.input = new GainNode(this.context);
    __privateSet(this, _volume, new GainNode(this.context));
    __privateSet(this, _disconnect, connectSerial([
      this.input,
      __privateGet(this, _volume),
      __privateGet(this, _options).destination
    ]));
    const volume = createControl(options.volume ?? 100);
    this.setVolume = volume.set;
    const volumeToGain = options.volumeToGain ?? midiVelToGain;
    __privateSet(this, _unsubscribe, volume.subscribe((volume2) => {
      __privateGet(this, _volume).gain.value = volumeToGain(volume2);
    }));
  }
  addInsert(effect) {
    __privateGet(this, _inserts) ?? __privateSet(this, _inserts, []);
    __privateGet(this, _inserts).push(effect);
    __privateGet(this, _disconnect).call(this);
    __privateSet(this, _disconnect, connectSerial([
      this.input,
      ...__privateGet(this, _inserts),
      __privateGet(this, _volume),
      __privateGet(this, _options).destination
    ]));
  }
  addEffect(name, effect, mixValue) {
    const mix = new GainNode(this.context);
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([__privateGet(this, _volume), mix, input]);
    __privateGet(this, _sends) ?? __privateSet(this, _sends, []);
    __privateGet(this, _sends).push({ name, mix, disconnect });
  }
  sendEffect(name, mix) {
    var _a;
    const send = (_a = __privateGet(this, _sends)) == null ? void 0 : _a.find((send2) => send2.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }
  disconnect() {
    var _a;
    __privateGet(this, _disconnect).call(this);
    __privateGet(this, _unsubscribe).call(this);
    (_a = __privateGet(this, _sends)) == null ? void 0 : _a.forEach((send) => send.disconnect());
    __privateSet(this, _sends, void 0);
  }
};
_volume = new WeakMap();
_sends = new WeakMap();
_inserts = new WeakMap();
_disconnect = new WeakMap();
_unsubscribe = new WeakMap();
_options = new WeakMap();

// src/sampler/start-sample.ts
function startSample(sample) {
  var _a;
  if (sample.buffer === null)
    return () => void 0;
  const context = sample.destination.context;
  const source = context.createBufferSource();
  source.buffer = sample.buffer;
  source.detune.value = (sample == null ? void 0 : sample.detune) ?? 0;
  const lpf = sample.lpfCutoffHz ? new BiquadFilterNode(context, {
    type: "lowpass",
    frequency: sample.lpfCutoffHz
  }) : void 0;
  const volume = context.createGain();
  volume.gain.value = (sample == null ? void 0 : sample.gain) ?? 1;
  const [decay, startDecay] = createDecayEnvelope(context, sample.decayTime);
  source.onended = unsubscribeAll([
    connectSerial([source, lpf, volume, decay, sample.destination]),
    (_a = sample.stop) == null ? void 0 : _a.call(sample, (sampleStop) => {
      if (sampleStop === void 0 || sampleStop.stopId === void 0 || sampleStop.stopId === sample.stopId) {
        stop(sampleStop == null ? void 0 : sampleStop.time);
      }
    })
  ]);
  const startAt = sample.time || context.currentTime;
  source.start(startAt);
  function stop(time) {
    time ?? (time = context.currentTime);
    if (time <= startAt) {
      source.stop(time);
    } else {
      const stopAt = startDecay(time);
      source.stop(stopAt);
    }
  }
  if (sample.duration !== void 0) {
    stop(startAt + sample.duration);
  }
  return stop;
}
function createDecayEnvelope(context, envelopeTime = 0.2) {
  let stopAt = 0;
  const envelope = new GainNode(context, { gain: 1 });
  function start(time) {
    if (stopAt)
      return stopAt;
    envelope.gain.cancelScheduledValues(time);
    const envelopeAt = time || context.currentTime;
    stopAt = envelopeAt + envelopeTime;
    envelope.gain.setValueAtTime(1, envelopeAt);
    envelope.gain.linearRampToValueAtTime(0, stopAt);
    return stopAt;
  }
  return [envelope, start];
}

// src/sampler/audio-buffers.ts
async function loadAudioBuffer(context, url) {
  url = url.replace(/#/g, "%23").replace(/([^:]\/)\/+/g, "$1");
  const response = await fetch(url);
  if (response.status !== 200) {
    console.warn(
      "Error loading buffer. Invalid status: ",
      response.status,
      url
    );
    return;
  }
  try {
    const audioData = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(audioData);
    return buffer;
  } catch (error) {
    console.warn("Error loading buffer", error, url);
  }
}
function findNearestMidi(midi, buffers) {
  let i = 0;
  while (buffers[midi + i] === void 0 && i < 128) {
    if (i > 0)
      i = -i;
    else
      i = -i + 1;
  }
  return i === 127 ? [midi, 0] : [midi + i, -i * 100];
}

// src/sfz/sfz-load.ts
async function loadSfzBuffers(context, buffers, websfz) {
  websfz.groups.forEach((group) => {
    const urls = getWebsfzGroupUrls(websfz, group);
    return loadAudioBuffers(context, buffers, urls);
  });
}
async function loadSfzInstrument(instrument) {
  var _a, _b, _c;
  const isWebsfz = (inst) => "global" in inst;
  const isSfzInstrument = (inst) => "websfzUrl" in inst;
  if (typeof instrument === "string") {
    return fetchWebSfz(instrument);
  } else if (isWebsfz(instrument)) {
    return instrument;
  } else if (isSfzInstrument(instrument)) {
    const websfz = await fetchWebSfz(instrument.websfzUrl);
    websfz.meta ?? (websfz.meta = {});
    (_a = websfz.meta).name ?? (_a.name = instrument.name);
    (_b = websfz.meta).baseUrl ?? (_b.baseUrl = instrument.baseUrl);
    (_c = websfz.meta).formats ?? (_c.formats = instrument.formats);
    return websfz;
  } else {
    throw new Error("Invalid instrument: " + JSON.stringify(instrument));
  }
}
async function loadAudioBuffers(context, buffers, urls) {
  await Promise.all(
    Object.keys(urls).map(async (sampleId) => {
      if (buffers[sampleId])
        return;
      const buffer = await loadAudioBuffer(context, urls[sampleId]);
      if (buffer)
        buffers[sampleId] = buffer;
      return buffers;
    })
  );
}
async function fetchWebSfz(url) {
  try {
    const response = await fetch(url);
    const json = await response.json();
    return json;
  } catch (error) {
    console.warn(`Can't load SFZ file ${url}`, error);
    throw new Error(`Can't load SFZ file ${url}`);
  }
}
function getWebsfzGroupUrls(websfz, group, format = ".ogg") {
  const urls = {};
  const baseUrl = websfz.meta.baseUrl ?? "";
  const prefix = websfz.global["default_path"] ?? "";
  if (!group)
    return urls;
  return group.regions.reduce((urls2, region) => {
    if (region.sample) {
      urls2[region.sample] = `${baseUrl}/${prefix}${region.sample}${format}`;
    }
    return urls2;
  }, urls);
}

// src/sfz/sfz-regions.ts
function checkRange(value, low, hi) {
  const isAboveLow = low === void 0 || value !== void 0 && value >= low;
  const isBelowHi = hi === void 0 || value !== void 0 && value <= hi;
  return isAboveLow && isBelowHi;
}
function findRegions(websfz, note) {
  const regions = [];
  for (const group of websfz.groups) {
    if (checkRange(note.midi, group.lokey, group.hikey) && checkRange(note.velocity, group.lovel, group.hivel) && checkRange(note.cc64, group.locc64, group.hicc64)) {
      for (const region of group.regions) {
        if (checkRange(note.midi, region.lokey, region.hikey) && checkRange(note.velocity, region.lovel, region.hivel) && checkRange(note.cc64, group.locc64, group.hicc64)) {
          regions.push([group, region]);
        }
      }
    }
  }
  return regions;
}

// src/sfz-sampler.ts
var EMPTY_WEBSFZ = Object.freeze({
  meta: {},
  global: {},
  groups: []
});
var _websfz, _config, _stop, _load, _output;
var SfzSampler = class {
  constructor(context, options) {
    this.context = context;
    __privateAdd(this, _websfz, void 0);
    __privateAdd(this, _config, void 0);
    __privateAdd(this, _stop, void 0);
    __privateAdd(this, _load, void 0);
    __privateAdd(this, _output, void 0);
    __privateSet(this, _config, {
      instrument: options.instrument,
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      decayTime: 0.3
    });
    this.buffers = {};
    __privateSet(this, _stop, createTrigger());
    __privateSet(this, _websfz, EMPTY_WEBSFZ);
    __privateSet(this, _load, loadSfzInstrument(options.instrument).then((result) => {
      __privateSet(this, _websfz, Object.freeze(result));
      return loadSfzBuffers(context, this.buffers, __privateGet(this, _websfz));
    }));
    __privateSet(this, _output, new Channel(context, __privateGet(this, _config)));
    this.output = __privateGet(this, _output);
  }
  async loaded() {
    await __privateGet(this, _load);
    return this;
  }
  start(note) {
    const _note = typeof note === "object" ? note : { note };
    const midi = toMidi(_note.note);
    if (midi === void 0)
      return () => void 0;
    const velocity = _note.velocity ?? __privateGet(this, _config).velocity;
    const regions = findRegions(__privateGet(this, _websfz), { midi, velocity });
    const stopAll = regions.map(([group, region]) => {
      let target = region.pitch_keycenter ?? region.key ?? midi;
      const detune = (midi - target) * 100;
      const destination = this.output.input;
      return startSample({
        buffer: this.buffers[region.sample] ?? null,
        destination,
        decayTime: _note.decayTime ?? __privateGet(this, _config).decayTime,
        detune: detune + (_note.detune ?? __privateGet(this, _config).detune),
        gain: midiVelToGain(_note.velocity ?? __privateGet(this, _config).velocity),
        time: _note.time,
        duration: _note.duration,
        stop: __privateGet(this, _stop).subscribe,
        stopId: _note.stopId ?? _note.note
      });
    });
    return (time) => stopAll.forEach((stop) => stop(time));
  }
  stop(note) {
    const note_ = typeof note === "object" ? note : { stopId: note };
    __privateGet(this, _stop).trigger(note_);
  }
  disconnect() {
    this.stop();
    __privateGet(this, _output).disconnect();
  }
};
_websfz = new WeakMap();
_config = new WeakMap();
_stop = new WeakMap();
_load = new WeakMap();
_output = new WeakMap();

// src/tremolo.ts
function createTremolo(context, depth) {
  const input = new GainNode(context);
  const output = new GainNode(context);
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  const splitter = new ChannelSplitterNode(context, { numberOfOutputs: 2 });
  const ampL = new GainNode(context);
  const ampR = new GainNode(context);
  const merger = new ChannelMergerNode(context, { numberOfInputs: 2 });
  const lfoL = new OscillatorNode(context, {
    type: "sine",
    frequency: 1
  });
  lfoL.start();
  const lfoLAmp = new GainNode(context);
  const lfoR = new OscillatorNode(context, {
    type: "sine",
    frequency: 1.1
  });
  lfoR.start();
  const lfoRAmp = new GainNode(context);
  input.connect(splitter);
  splitter.connect(ampL, 0);
  splitter.connect(ampR, 1);
  ampL.connect(merger, 0, 0);
  ampR.connect(merger, 0, 1);
  lfoL.connect(lfoLAmp);
  lfoLAmp.connect(ampL.gain);
  lfoR.connect(lfoRAmp);
  lfoRAmp.connect(ampR.gain);
  merger.connect(output);
  const unsubscribe = depth((depth2) => {
    lfoLAmp.gain.value = depth2;
    lfoRAmp.gain.value = depth2;
  });
  input.disconnect = () => {
    unsubscribe();
    lfoL.stop();
    lfoR.stop();
    input.disconnect(splitter);
    splitter.disconnect(ampL, 0);
    splitter.disconnect(ampR, 1);
    ampL.disconnect(merger, 0, 0);
    ampR.disconnect(merger, 0, 1);
    lfoL.disconnect(ampL);
    lfoR.disconnect(ampR);
    merger.disconnect(output);
  };
  return { input, output };
}

// src/electric-piano.ts
var ElectricPianoInstruments = {
  // RhodesMkI: {
  //   name: "RhodesMkI",
  //   websfzUrl:
  //     "https://danigb.github.io/samples/jlearman/rhodes-mki/jrhodes3dst.websfz.json",
  // },
  CP80: {
    name: "CP80",
    websfzUrl: "https://danigb.github.io/samples/gs-e-pianos/CP80/cp80.websfz.json"
  },
  PianetT: {
    name: "PianetT",
    websfzUrl: "https://danigb.github.io/samples/gs-e-pianos/Pianet T/pianet-t.websfz.json"
  },
  WurlitzerEP200: {
    name: "WurlitzerEP200",
    websfzUrl: "https://danigb.github.io/samples/gs-e-pianos/Wurlitzer EP200/wurlitzer-ep200.websfz.json"
  }
};
var ElectricPiano = class extends SfzSampler {
  constructor(context, options) {
    super(context, {
      ...options,
      instrument: ElectricPianoInstruments[options.instrument] ?? options.instrument
    });
    const depth = createControl(0);
    this.tremolo = {
      level: (level) => depth.set(midiVelToGain(level))
    };
    const tremolo = createTremolo(context, depth.subscribe);
    this.output.addInsert(tremolo);
  }
};

// src/mallet.ts
function getMalletNames() {
  return Object.keys(DATA);
}
var Mallet = class extends SfzSampler {
  constructor(context, options) {
    const instrument = getMallet(options.instrument);
    super(context, {
      ...options,
      instrument
    });
  }
};
function getMallet(name) {
  if (!DATA[name])
    throw Error(`Mallet instrument "${name}" not valid`);
  return {
    name,
    websfzUrl: BASE_URL + DATA[name] + EXT
  };
}
var BASE_URL = "https://danigb.github.io/samples/vcsl/";
var EXT = ".websfz.json";
var DATA = {
  "Balafon - Hard Mallet": "Struck Idiophones/balafon-hard-mallet",
  "Balafon - Keyswitch": "Struck Idiophones/balafon-keyswitch",
  "Balafon - Soft Mallet": "Struck Idiophones/balafon-soft-mallet",
  "Balafon - Traditional Mallet": "Struck Idiophones/balafon-traditional-mallet",
  "Tubular Bells 1": "Struck Idiophones/tubular-bells-1",
  "Tubular Bells 2": "Struck Idiophones/tubular-bells-2",
  "Vibraphone - Hard Mallets": "Struck Idiophones/vibraphone-hard-mallets",
  "Vibraphone - Keyswitch": "Struck Idiophones/vibraphone-keyswitch",
  "Vibraphone - Soft Mallets": "Struck Idiophones/vibraphone-soft-mallets",
  "Xylophone - Hard Mallets": "Struck Idiophones/xylophone-hard-mallets",
  "Xylophone - Keyswitch": "Struck Idiophones/xylophone-keyswitch",
  "Xylophone - Medium Mallets": "Struck Idiophones/xylophone-medium-mallets",
  "Xylophone - Soft Mallets": "Struck Idiophones/xylophone-soft-mallets"
};

// src/reverb/processor.min.ts
var PROCESSOR = `"use strict";(()=>{var f=class extends AudioWorkletProcessor{_pDLength;_preDelay;_pDWrite;_lp1;_lp2;_lp3;_excPhase;_taps;_Delays;sampleRate;static get parameterDescriptors(){return[["preDelay",0,0,sampleRate-1,"k-rate"],["bandwidth",.9999,0,1,"k-rate"],["inputDiffusion1",.75,0,1,"k-rate"],["inputDiffusion2",.625,0,1,"k-rate"],["decay",.5,0,1,"k-rate"],["decayDiffusion1",.7,0,.999999,"k-rate"],["decayDiffusion2",.5,0,.999999,"k-rate"],["damping",.005,0,1,"k-rate"],["excursionRate",.5,0,2,"k-rate"],["excursionDepth",.7,0,2,"k-rate"],["wet",1,0,1,"k-rate"],["dry",0,0,1,"k-rate"]].map(e=>new Object({name:e[0],defaultValue:e[1],minValue:e[2],maxValue:e[3],automationRate:e[4]}))}constructor(e){super(),this.sampleRate=sampleRate,this._Delays=[],this._pDLength=sampleRate+(128-sampleRate%128),this._preDelay=new Float32Array(this._pDLength),this._pDWrite=0,this._lp1=0,this._lp2=0,this._lp3=0,this._excPhase=0,[.004771345,.003595309,.012734787,.009307483,.022579886,.149625349,.060481839,.1249958,.030509727,.141695508,.089244313,.106280031].forEach(a=>this.makeDelay(a,sampleRate)),this._taps=Int16Array.from([.008937872,.099929438,.064278754,.067067639,.066866033,.006283391,.035818689,.011861161,.121870905,.041262054,.08981553,.070931756,.011256342,.004065724],a=>Math.round(a*sampleRate))}makeDelay(e,a){let t=Math.round(e*a),s=2**Math.ceil(Math.log2(t));this._Delays.push([new Float32Array(s),t-1,0,s-1])}writeDelay(e,a){return this._Delays[e][0][this._Delays[e][1]]=a}readDelay(e){return this._Delays[e][0][this._Delays[e][2]]}readDelayAt(e,a){let t=this._Delays[e];return t[0][t[2]+a&t[3]]}readDelayCAt(e,a){let t=this._Delays[e],s=a-~~a,d=~~a+t[2]-1,r=t[3],D=t[0][d++&r],l=t[0][d++&r],h=t[0][d++&r],y=t[0][d&r],u=(3*(l-h)-D+y)/2,m=2*h+D-(5*l+y)/2,c=(h-D)/2;return((u*s+m)*s+c)*s+l}process(e,a,t){let s=~~t.preDelay[0],d=t.bandwidth[0],r=t.inputDiffusion1[0],D=t.inputDiffusion2[0],l=t.decay[0],h=t.decayDiffusion1[0],y=t.decayDiffusion2[0],u=1-t.damping[0],m=t.excursionRate[0]/sampleRate,c=t.excursionDepth[0]*sampleRate/1e3,w=t.wet[0]*.6,A=t.dry[0];if(e[0].length==2)for(let i=127;i>=0;i--)this._preDelay[this._pDWrite+i]=(e[0][0][i]+e[0][1][i])*.5,a[0][0][i]=e[0][0][i]*A,a[0][1][i]=e[0][1][i]*A;else if(e[0].length>0){this._preDelay.set(e[0][0],this._pDWrite);for(let i=127;i>=0;i--)a[0][0][i]=a[0][1][i]=e[0][0][i]*A}else this._preDelay.set(new Float32Array(128),this._pDWrite);let o=0;for(;o<128;){let i=0,b=0;this._lp1+=d*(this._preDelay[(this._pDLength+this._pDWrite-s+o)%this._pDLength]-this._lp1);let p=this.writeDelay(0,this._lp1-r*this.readDelay(0));p=this.writeDelay(1,r*(p-this.readDelay(1))+this.readDelay(0)),p=this.writeDelay(2,r*p+this.readDelay(1)-D*this.readDelay(2)),p=this.writeDelay(3,D*(p-this.readDelay(3))+this.readDelay(2));let k=D*p+this.readDelay(3),g=c*(1+Math.cos(this._excPhase*6.28)),x=c*(1+Math.sin(this._excPhase*6.2847)),_=this.writeDelay(4,k+l*this.readDelay(11)+h*this.readDelayCAt(4,g));this.writeDelay(5,this.readDelayCAt(4,g)-h*_),this._lp2+=u*(this.readDelay(5)-this._lp2),_=this.writeDelay(6,l*this._lp2-y*this.readDelay(6)),this.writeDelay(7,this.readDelay(6)+y*_),_=this.writeDelay(8,k+l*this.readDelay(7)+h*this.readDelayCAt(8,x)),this.writeDelay(9,this.readDelayCAt(8,x)-h*_),this._lp3+=u*(this.readDelay(9)-this._lp3),_=this.writeDelay(10,l*this._lp3-y*this.readDelay(10)),this.writeDelay(11,this.readDelay(10)+y*_),i=this.readDelayAt(9,this._taps[0])+this.readDelayAt(9,this._taps[1])-this.readDelayAt(10,this._taps[2])+this.readDelayAt(11,this._taps[3])-this.readDelayAt(5,this._taps[4])-this.readDelayAt(6,this._taps[5])-this.readDelayAt(7,this._taps[6]),b=this.readDelayAt(5,this._taps[7])+this.readDelayAt(5,this._taps[8])-this.readDelayAt(6,this._taps[9])+this.readDelayAt(7,this._taps[10])-this.readDelayAt(9,this._taps[11])-this.readDelayAt(10,this._taps[12])-this.readDelayAt(11,this._taps[13]),a[0][0][o]+=i*w,a[0][1][o]+=b*w,this._excPhase+=m,o++;for(let R=0,n=this._Delays[0];R<this._Delays.length;n=this._Delays[++R])n[1]=n[1]+1&n[3],n[2]=n[2]+1&n[3]}return this._pDWrite=(this._pDWrite+128)%this._pDLength,!0}};registerProcessor("DattorroReverb",f);})();`;

// src/reverb.ts
var PARAMS = [
  "preDelay",
  "bandwidth",
  "inputDiffusion1",
  "inputDiffusion2",
  "decay",
  "decayDiffusion1",
  "decayDiffusion2",
  "damping",
  "excursionRate",
  "excursionDepth",
  "wet",
  "dry"
];
var init = /* @__PURE__ */ new WeakMap();
async function createDattorroReverbEffect(context) {
  let ready = init.get(context);
  if (!ready) {
    const blob = new Blob([PROCESSOR], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    ready = context.audioWorklet.addModule(url);
    init.set(context, ready);
  }
  await ready;
  const reverb = new AudioWorkletNode(context, "DattorroReverb", {
    outputChannelCount: [2]
  });
  return reverb;
}
var _effect, _ready, _output2;
var Reverb = class {
  constructor(context) {
    __privateAdd(this, _effect, void 0);
    __privateAdd(this, _ready, void 0);
    __privateAdd(this, _output2, void 0);
    this.input = context.createGain();
    __privateSet(this, _output2, context.destination);
    __privateSet(this, _ready, createDattorroReverbEffect(context).then((reverb) => {
      this.input.connect(reverb);
      reverb.connect(__privateGet(this, _output2));
      __privateSet(this, _effect, reverb);
      return this;
    }));
  }
  get paramNames() {
    return PARAMS;
  }
  getParam(name) {
    var _a;
    return (_a = __privateGet(this, _effect)) == null ? void 0 : _a.parameters.get("preDelay");
  }
  get isReady() {
    return __privateGet(this, _effect) !== void 0;
  }
  ready() {
    return __privateGet(this, _ready);
  }
  connect(output) {
    if (__privateGet(this, _effect)) {
      __privateGet(this, _effect).disconnect(__privateGet(this, _output2));
      __privateGet(this, _effect).connect(output);
    }
    __privateSet(this, _output2, output);
  }
};
_effect = new WeakMap();
_ready = new WeakMap();
_output2 = new WeakMap();

// src/sampler.ts
var _config2, _stop2, _load2, _output3;
var Sampler = class {
  constructor(context, options) {
    this.context = context;
    __privateAdd(this, _config2, void 0);
    __privateAdd(this, _stop2, void 0);
    __privateAdd(this, _load2, void 0);
    __privateAdd(this, _output3, void 0);
    __privateSet(this, _config2, {
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      buffers: options.buffers ?? {},
      volumeToGain: options.volumeToGain ?? midiVelToGain,
      noteToSample: options.noteToSample ?? ((note) => [note.note.toString(), 0])
    });
    this.buffers = {};
    __privateSet(this, _stop2, createTrigger());
    const loader = typeof __privateGet(this, _config2).buffers === "function" ? __privateGet(this, _config2).buffers : createAudioBuffersLoader(__privateGet(this, _config2).buffers);
    __privateSet(this, _load2, loader(context, this.buffers));
    __privateSet(this, _output3, new Channel(context, __privateGet(this, _config2)));
    this.output = __privateGet(this, _output3);
  }
  async loaded() {
    await __privateGet(this, _load2);
    return this;
  }
  start(note) {
    const _note = typeof note === "object" ? note : { note };
    const [sample, detune] = __privateGet(this, _config2).noteToSample(
      _note,
      this.buffers,
      __privateGet(this, _config2)
    );
    const buffer = this.buffers[sample] ?? null;
    return startSample({
      buffer,
      destination: __privateGet(this, _output3).input,
      time: _note.time,
      duration: _note.duration,
      decayTime: _note.decayTime,
      lpfCutoffHz: _note.lpfCutoffHz,
      detune: detune + (_note.detune ?? __privateGet(this, _config2).detune),
      gain: __privateGet(this, _config2).volumeToGain(_note.velocity ?? __privateGet(this, _config2).velocity),
      stop: __privateGet(this, _stop2).subscribe,
      stopId: _note.stopId ?? _note.note
    });
  }
  stop(note) {
    const note_ = typeof note === "object" ? note : { stopId: note };
    __privateGet(this, _stop2).trigger(note_);
  }
};
_config2 = new WeakMap();
_stop2 = new WeakMap();
_load2 = new WeakMap();
_output3 = new WeakMap();
function createAudioBuffersLoader(source) {
  return async (context, buffers) => {
    await Promise.all([
      Object.keys(source).map(async (key) => {
        const value = source[key];
        if (value instanceof AudioBuffer) {
          buffers[key] = value;
        } else if (typeof value === "string") {
          const buffer = await loadAudioBuffer(context, value);
          if (buffer)
            buffers[key] = buffer;
        }
      })
    ]);
  };
}

// src/soundfont.ts
var Soundfont = class extends Sampler {
  constructor(context, options) {
    const urlBuilder = getUrlBuilder(options.library);
    const url = urlBuilder(options.instrument, options.format);
    super(context, {
      destination: options.destination,
      detune: options.detune,
      volume: options.volume,
      velocity: options.velocity,
      decayTime: options.decayTime ?? 0.5,
      lpfCutoffHz: options.lpfCutoffHz,
      buffers: soundfontLoader(url),
      noteToSample: (note, buffers, config) => {
        let midi = toMidi(note.note);
        return midi === void 0 ? ["", 0] : findNearestMidi(midi, buffers);
      }
    });
    const extraGain = options.extraGain ?? 5;
    const gain = new GainNode(context, { gain: extraGain });
    this.output.addInsert(gain);
  }
};
function getUrlBuilder(library) {
  return library === void 0 ? (instrument, format) => gleitzKitUrl("MusyngKite", instrument, format ?? "ogg") : typeof library === "function" ? library : library.url;
}
function soundfontLoader(url) {
  return async (context, buffers) => {
    const sourceFile = await (await fetch(url)).text();
    const json = midiJsToJson(sourceFile);
    const noteNames = Object.keys(json);
    await Promise.all(
      noteNames.map(async (noteName) => {
        const midi = toMidi(noteName);
        if (!midi)
          return;
        const audioData = base64ToArrayBuffer(
          removeBase64Prefix(json[noteName])
        );
        const buffer = await context.decodeAudioData(audioData);
        buffers[midi] = buffer;
      })
    );
  };
}
function midiJsToJson(source) {
  const header = source.indexOf("MIDI.Soundfont.");
  if (header < 0)
    throw Error("Invalid MIDI.js Soundfont format");
  const start = source.indexOf("=", header) + 2;
  const end = source.lastIndexOf(",");
  return JSON.parse(source.slice(start, end) + "}");
}
function removeBase64Prefix(audioBase64) {
  return audioBase64.slice(audioBase64.indexOf(",") + 1);
}
function base64ToArrayBuffer(base64) {
  const decoded = window.atob(base64);
  const len = decoded.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}
function gleitzKitUrl(kit, name, format) {
  return `https://gleitz.github.io/midi-js-soundfonts/${kit}/${name}-${format}.js`;
}
var FluidR3 = {
  name: "FluidR3_GM",
  url: (name, format = "mp3") => gleitzKitUrl("FluidR3_GM", name, format),
  instruments: [
    "accordion",
    "acoustic_bass",
    "acoustic_grand_piano",
    "acoustic_guitar_nylon",
    "acoustic_guitar_steel",
    "agogo",
    "alto_sax",
    "applause",
    "bagpipe",
    "banjo",
    "baritone_sax",
    "bassoon",
    "bird_tweet",
    "blown_bottle",
    "brass_section",
    "breath_noise",
    "bright_acoustic_piano",
    "celesta",
    "cello",
    "choir_aahs",
    "church_organ",
    "clarinet",
    "clavinet",
    "contrabass",
    "distortion_guitar",
    "drawbar_organ",
    "dulcimer",
    "electric_bass_finger",
    "electric_bass_pick",
    "electric_grand_piano",
    "electric_guitar_clean",
    "electric_guitar_jazz",
    "electric_guitar_muted",
    "electric_piano_1",
    "electric_piano_2",
    "english_horn",
    "fiddle",
    "flute",
    "french_horn",
    "fretless_bass",
    "fx_1_rain",
    "fx_2_soundtrack",
    "fx_3_crystal",
    "fx_4_atmosphere",
    "fx_5_brightness",
    "fx_6_goblins",
    "fx_7_echoes",
    "fx_8_scifi",
    "glockenspiel",
    "guitar_fret_noise",
    "guitar_harmonics",
    "gunshot",
    "harmonica",
    "harpsichord",
    "helicopter",
    "honkytonk_piano",
    "kalimba",
    "koto",
    "lead_1_square",
    "lead_2_sawtooth",
    "lead_3_calliope",
    "lead_4_chiff",
    "lead_5_charang",
    "lead_6_voice",
    "lead_7_fifths",
    "lead_8_bass__lead",
    "marimba",
    "melodic_tom",
    "music_box",
    "muted_trumpet",
    "oboe",
    "ocarina",
    "orchestra_hit",
    "orchestral_harp",
    "overdriven_guitar",
    "pad_1_new_age",
    "pad_2_warm",
    "pad_3_polysynth",
    "pad_4_choir",
    "pad_5_bowed",
    "pad_6_metallic",
    "pad_7_halo",
    "pad_8_sweep",
    "pan_flute",
    "percussive_organ",
    "percussion",
    "piccolo",
    "pizzicato_strings",
    "recorder",
    "reed_organ",
    "reverse_cymbal",
    "rock_organ",
    "seashore",
    "shakuhachi",
    "shamisen",
    "shanai",
    "sitar",
    "slap_bass_1",
    "slap_bass_2",
    "soprano_sax",
    "steel_drums",
    "string_ensemble_1",
    "string_ensemble_2",
    "synth_bass_1",
    "synth_bass_2",
    "synth_brass_1",
    "synth_brass_2",
    "synth_choir",
    "synth_drum",
    "synth_strings_1",
    "synth_strings_2",
    "taiko_drum",
    "tango_accordion",
    "telephone_ring",
    "tenor_sax",
    "timpani",
    "tinkle_bell",
    "tremolo_strings",
    "trombone",
    "trumpet",
    "tuba",
    "tubular_bells",
    "vibraphone",
    "viola",
    "violin",
    "voice_oohs",
    "whistle",
    "woodblock",
    "xylophone"
  ]
};
var MusyngKite = {
  name: "MusyngKite",
  url: (name, format = "mp3") => gleitzKitUrl("MusyngKite", name, format),
  instruments: [
    "accordion",
    "acoustic_bass",
    "acoustic_grand_piano",
    "acoustic_guitar_nylon",
    "acoustic_guitar_steel",
    "agogo",
    "alto_sax",
    "applause",
    "bagpipe",
    "banjo",
    "baritone_sax",
    "bassoon",
    "bird_tweet",
    "blown_bottle",
    "brass_section",
    "breath_noise",
    "bright_acoustic_piano",
    "celesta",
    "cello",
    "choir_aahs",
    "church_organ",
    "clarinet",
    "clavinet",
    "contrabass",
    "distortion_guitar",
    "drawbar_organ",
    "dulcimer",
    "electric_bass_finger",
    "electric_bass_pick",
    "electric_grand_piano",
    "electric_guitar_clean",
    "electric_guitar_jazz",
    "electric_guitar_muted",
    "electric_piano_1",
    "electric_piano_2",
    "english_horn",
    "fiddle",
    "flute",
    "french_horn",
    "fretless_bass",
    "fx_1_rain",
    "fx_2_soundtrack",
    "fx_3_crystal",
    "fx_4_atmosphere",
    "fx_5_brightness",
    "fx_6_goblins",
    "fx_7_echoes",
    "fx_8_scifi",
    "glockenspiel",
    "guitar_fret_noise",
    "guitar_harmonics",
    "gunshot",
    "harmonica",
    "harpsichord",
    "helicopter",
    "honkytonk_piano",
    "kalimba",
    "koto",
    "lead_1_square",
    "lead_2_sawtooth",
    "lead_3_calliope",
    "lead_4_chiff",
    "lead_5_charang",
    "lead_6_voice",
    "lead_7_fifths",
    "lead_8_bass__lead",
    "marimba",
    "melodic_tom",
    "music_box",
    "muted_trumpet",
    "oboe",
    "ocarina",
    "orchestra_hit",
    "orchestral_harp",
    "overdriven_guitar",
    "pad_1_new_age",
    "pad_2_warm",
    "pad_3_polysynth",
    "pad_4_choir",
    "pad_5_bowed",
    "pad_6_metallic",
    "pad_7_halo",
    "pad_8_sweep",
    "pan_flute",
    "percussive_organ",
    "piccolo",
    "pizzicato_strings",
    "recorder",
    "reed_organ",
    "reverse_cymbal",
    "rock_organ",
    "seashore",
    "shakuhachi",
    "shamisen",
    "shanai",
    "sitar",
    "slap_bass_1",
    "slap_bass_2",
    "soprano_sax",
    "steel_drums",
    "string_ensemble_1",
    "string_ensemble_2",
    "synth_bass_1",
    "synth_bass_2",
    "synth_brass_1",
    "synth_brass_2",
    "synth_choir",
    "synth_drum",
    "synth_strings_1",
    "synth_strings_2",
    "taiko_drum",
    "tango_accordion",
    "telephone_ring",
    "tenor_sax",
    "timpani",
    "tinkle_bell",
    "tremolo_strings",
    "trombone",
    "trumpet",
    "tuba",
    "tubular_bells",
    "vibraphone",
    "viola",
    "violin",
    "voice_oohs",
    "whistle",
    "woodblock",
    "xylophone"
  ]
};
var SoundfontLibraries = {
  FluidR3,
  MusyngKite
};

// src/splendid-grand-piano.ts
var BASE_URL2 = "https://danigb.github.io/samples/splendid-grand-piano";
var FORMAT = "ogg";
var SplendidGrandPiano = class extends Sampler {
  constructor(context, options) {
    super(context, {
      destination: options.destination,
      detune: options.detune,
      volume: options.volume,
      velocity: options.velocity,
      decayTime: options.decayTime ?? 0.5,
      lpfCutoffHz: options.lpfCutoffHz,
      buffers: splendidGrandPianoLoader(
        options.baseUrl ?? BASE_URL2,
        options.format ?? FORMAT
      ),
      noteToSample: (note, buffers, config) => {
        if (typeof note.note === "string")
          return [note.note, 0];
        const vel = note.velocity ?? config.velocity;
        const layerIdx = LAYERS.findIndex(
          (layer2) => vel >= layer2.vel_range[0] && vel <= layer2.vel_range[1]
        );
        const layer = LAYERS[layerIdx];
        if (!layer)
          return ["", 0];
        return findNearestMidiInLayer(layer.name, note.note, buffers);
      }
    });
  }
};
function findNearestMidiInLayer(prefix, midi, buffers) {
  let i = 0;
  while (buffers[prefix + (midi + i)] === void 0 && i < 128) {
    if (i > 0)
      i = -i;
    else
      i = -i + 1;
  }
  return i === 127 ? [prefix + midi, 0] : [prefix + (midi + i), -i * 100];
}
function splendidGrandPianoLoader(baseUrl, format) {
  return async (context, buffers) => {
    for (const layer of LAYERS) {
      await Promise.all(
        layer.samples.map(async ([midi, name]) => {
          const url = `${baseUrl}/${name}.${format}`;
          const buffer = await loadAudioBuffer(context, url);
          if (buffer)
            buffers[layer.name + midi] = buffer;
        })
      );
    }
  };
}
var LAYERS = [
  {
    name: "PPP",
    vel_range: [1, 40],
    cutoff: 1e3,
    samples: [
      [23, "PP-B-1"],
      [27, "PP-D#0"],
      [29, "PP-F0"],
      [31, "PP-G0"],
      [33, "PP-A0"],
      [35, "PP-B0"],
      [37, "PP-C#1"],
      [38, "PP-D1"],
      [40, "PP-E1"],
      [41, "PP-F1"],
      [43, "PP-G1"],
      [45, "PP-A1"],
      [47, "PP-B1"],
      [48, "PP-C2"],
      [50, "PP-D2"],
      [52, "PP-E2"],
      [53, "PP-F2"],
      [55, "PP-G2"],
      [56, "PP-G#2"],
      [57, "PP-A2"],
      [58, "PP-A#2"],
      [59, "PP-B2"],
      [60, "PP-C3"],
      [62, "PP-D3"],
      [64, "PP-E3"],
      [65, "PP-F3"],
      [67, "PP-G3"],
      [69, "PP-A3"],
      [71, "PP-B3"],
      [72, "PP-C4"],
      [74, "PP-D4"],
      [76, "PP-E4"],
      [77, "PP-F4"],
      [79, "PP-G4"],
      [80, "PP-G#4"],
      [81, "PP-A4"],
      [82, "PP-A#4"],
      [83, "PP-B4"],
      [85, "PP-C#5"],
      [86, "PP-D5"],
      [87, "PP-D#5"],
      [89, "PP-F5"],
      [90, "PP-F#5"],
      [91, "PP-G5"],
      [92, "PP-G#5"],
      [93, "PP-A5"],
      [94, "PP-A#5"],
      [95, "PP-B5"],
      [96, "PP-C6"],
      [97, "PP-C#6"],
      [98, "PP-D6"],
      [99, "PP-D#6"],
      [100, "PP-E6"],
      [101, "PP-F6"],
      [102, "PP-F#6"],
      [103, "PP-G6"],
      [104, "PP-G#6"],
      [105, "PP-A6"],
      [106, "PP-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"]
    ]
  },
  {
    name: "PP",
    vel_range: [41, 67],
    samples: [
      [23, "PP-B-1"],
      [27, "PP-D#0"],
      [29, "PP-F0"],
      [31, "PP-G0"],
      [33, "PP-A0"],
      [35, "PP-B0"],
      [37, "PP-C#1"],
      [38, "PP-D1"],
      [40, "PP-E1"],
      [41, "PP-F1"],
      [43, "PP-G1"],
      [45, "PP-A1"],
      [47, "PP-B1"],
      [48, "PP-C2"],
      [50, "PP-D2"],
      [52, "PP-E2"],
      [53, "PP-F2"],
      [55, "PP-G2"],
      [56, "PP-G#2"],
      [57, "PP-A2"],
      [58, "PP-A#2"],
      [59, "PP-B2"],
      [60, "PP-C3"],
      [62, "PP-D3"],
      [64, "PP-E3"],
      [65, "PP-F3"],
      [67, "PP-G3"],
      [69, "PP-A3"],
      [71, "PP-B3"],
      [72, "PP-C4"],
      [74, "PP-D4"],
      [76, "PP-E4"],
      [77, "PP-F4"],
      [79, "PP-G4"],
      [80, "PP-G#4"],
      [81, "PP-A4"],
      [82, "PP-A#4"],
      [83, "PP-B4"],
      [85, "PP-C#5"],
      [86, "PP-D5"],
      [87, "PP-D#5"],
      [89, "PP-F5"],
      [90, "PP-F#5"],
      [91, "PP-G5"],
      [92, "PP-G#5"],
      [93, "PP-A5"],
      [94, "PP-A#5"],
      [95, "PP-B5"],
      [96, "PP-C6"],
      [97, "PP-C#6"],
      [98, "PP-D6"],
      [99, "PP-D#6"],
      [100, "PP-E6"],
      [101, "PP-F6"],
      [102, "PP-F#6"],
      [103, "PP-G6"],
      [104, "PP-G#6"],
      [105, "PP-A6"],
      [106, "PP-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"]
    ]
  },
  {
    name: "MP",
    vel_range: [68, 84],
    samples: [
      [23, "Mp-B-1"],
      [27, "Mp-D#0"],
      [29, "Mp-F0"],
      [31, "Mp-G0"],
      [33, "Mp-A0"],
      [35, "Mp-B0"],
      [37, "Mp-C#1"],
      [38, "Mp-D1"],
      [40, "Mp-E1"],
      [41, "Mp-F1"],
      [43, "Mp-G1"],
      [45, "Mp-A1"],
      [47, "Mp-B1"],
      [48, "Mp-C2"],
      [50, "Mp-D2"],
      [52, "Mp-E2"],
      [53, "Mp-F2"],
      [55, "Mp-G2"],
      [56, "Mp-G#2"],
      [57, "Mp-A2"],
      [58, "Mp-A#2"],
      [59, "Mp-B2"],
      [60, "Mp-C3"],
      [62, "Mp-D3"],
      [64, "Mp-E3"],
      [65, "Mp-F3"],
      [67, "Mp-G3"],
      [69, "Mp-A3"],
      [71, "Mp-B3"],
      [72, "Mp-C4"],
      [74, "Mp-D4"],
      [76, "Mp-E4"],
      [77, "Mp-F4"],
      [79, "Mp-G4"],
      [80, "Mp-G#4"],
      [81, "Mp-A4"],
      [82, "Mp-A#4"],
      [83, "Mp-B4"],
      [85, "Mp-C#5"],
      [86, "Mp-D5"],
      [87, "Mp-D#5"],
      [88, "Mp-E5"],
      [89, "Mp-F5"],
      [90, "Mp-F#5"],
      [91, "Mp-G5"],
      [92, "Mp-G#5"],
      [93, "Mp-A5"],
      [94, "Mp-A#5"],
      [95, "Mp-B5"],
      [96, "Mp-C6"],
      [97, "Mp-C#6"],
      [98, "Mp-D6"],
      [99, "Mp-D#6"],
      [100, "PP-E6"],
      [101, "Mp-F6"],
      [102, "Mp-F#6"],
      [103, "Mp-G6"],
      [104, "Mp-G#6"],
      [105, "Mp-A6"],
      [106, "Mp-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"]
    ]
  },
  {
    name: "MF",
    vel_range: [85, 100],
    samples: [
      [23, "Mf-B-1"],
      [27, "Mf-D#0"],
      [29, "Mf-F0"],
      [31, "Mf-G0"],
      [33, "Mf-A0"],
      [35, "Mf-B0"],
      [37, "Mf-C#1"],
      [38, "Mf-D1"],
      [40, "Mf-E1"],
      [41, "Mf-F1"],
      [43, "Mf-G1"],
      [45, "Mf-A1"],
      [47, "Mf-B1"],
      [48, "Mf-C2"],
      [50, "Mf-D2"],
      [52, "Mf-E2"],
      [53, "Mf-F2"],
      [55, "Mf-G2"],
      [56, "Mf-G#2"],
      [57, "Mf-A2"],
      [58, "Mf-A#2"],
      [59, "Mf-B2"],
      [60, "Mf-C3"],
      [62, "Mf-D3"],
      [64, "Mf-E3"],
      [65, "Mf-F3"],
      [67, "Mf-G3"],
      [69, "Mf-A3"],
      [71, "Mf-B3"],
      [72, "Mf-C4"],
      [74, "Mf-D4"],
      [76, "Mf-E4"],
      [77, "Mf-F4"],
      [79, "Mf-G4"],
      [80, "Mf-G#4"],
      [81, "Mf-A4"],
      [82, "Mf-A#4"],
      [83, "Mf-B4"],
      [85, "Mf-C#5"],
      [86, "Mf-D5"],
      [87, "Mf-D#5"],
      [88, "Mf-E5"],
      [89, "Mf-F5"],
      [90, "Mf-F#5"],
      [91, "Mf-G5"],
      [92, "Mf-G#5"],
      [93, "Mf-A5"],
      [94, "Mf-A#5"],
      [95, "Mf-B5"],
      [96, "Mf-C6"],
      [97, "Mf-C#6"],
      [98, "Mf-D6"],
      [99, "Mf-D#6"],
      [100, "Mf-E6"],
      [101, "Mf-F6"],
      [102, "Mf-F#6"],
      [103, "Mf-G6"],
      [104, "Mf-G#6"],
      [105, "Mf-A6"],
      [106, "Mf-A#6"],
      [107, "Mf-B6"],
      [108, "PP-C7"]
    ]
  },
  {
    name: "FF",
    vel_range: [101, 127],
    samples: [
      [23, "FF-B-1"],
      [27, "FF-D#0"],
      [29, "FF-F0"],
      [31, "FF-G0"],
      [33, "FF-A0"],
      [35, "FF-B0"],
      [37, "FF-C#1"],
      [38, "FF-D1"],
      [40, "FF-E1"],
      [41, "FF-F1"],
      [43, "FF-G1"],
      [45, "FF-A1"],
      [47, "FF-B1"],
      [48, "FF-C2"],
      [50, "FF-D2"],
      [52, "FF-E2"],
      [53, "FF-F2"],
      [55, "FF-G2"],
      [56, "FF-G#2"],
      [57, "FF-A2"],
      [58, "FF-A#2"],
      [59, "FF-B2"],
      [60, "FF-C3"],
      [62, "FF-D3"],
      [64, "FF-E3"],
      [65, "FF-F3"],
      [67, "FF-G3"],
      [69, "FF-A3"],
      [71, "FF-B3"],
      [72, "FF-C4"],
      [74, "FF-D4"],
      [76, "FF-E4"],
      [77, "FF-F4"],
      [79, "FF-G4"],
      [80, "FF-G#4"],
      [81, "FF-A4"],
      [82, "FF-A#4"],
      [83, "FF-B4"],
      [85, "FF-C#5"],
      [86, "FF-D5"],
      [88, "FF-E5"],
      [89, "FF-F5"],
      [91, "FF-G5"],
      [93, "FF-A5"],
      [95, "Mf-B5"],
      [96, "Mf-C6"],
      [97, "Mf-C#6"],
      [98, "Mf-D6"],
      [99, "Mf-D#6"],
      [100, "Mf-E6"],
      [102, "Mf-F#6"],
      [103, "Mf-G6"],
      [104, "Mf-G#6"],
      [105, "Mf-A6"],
      [106, "Mf-A#6"],
      [107, "Mf-B6"],
      [108, "Mf-C7"]
    ]
  }
];
export {
  DATA,
  ElectricPiano,
  ElectricPianoInstruments,
  FluidR3,
  LAYERS,
  Mallet,
  MusyngKite,
  Reverb,
  Sampler,
  Soundfont,
  SoundfontLibraries,
  SplendidGrandPiano,
  getMalletNames,
  gleitzKitUrl
};
//# sourceMappingURL=index.mjs.map