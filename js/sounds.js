/* ============================================================
   «ТҮРКІ ДӘУІРІ — JUMANJI» — Дыбыс қозғалтқышы (sounds.js)
   Web Audio API арқылы синтезделеді → интернетсіз де жұмыс істейді.
   ============================================================ */
(function(){
  let ctx = null;
  let enabled = true;

  function ac(){
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume().catch(()=>{});
    return ctx;
  }

  function tone(freq, dur=0.15, type="sine", vol=0.25, when=0, slideTo=null){
    if (!enabled) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur=0.3, vol=0.3, filterFreq=1200, when=0){
    if (!enabled) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  window.SOUND = {
    setEnabled(v){ enabled = v; },
    isEnabled(){ return enabled; },
    resume(){ ac(); },

    dice(){         /* кубик лықылдайды */
      for (let i=0;i<6;i++) noise(0.05, 0.22, 1400 + Math.random()*800, i*0.07);
      noise(0.12, 0.3, 900, 0.45);
    },
    step(){         /* фигура қадамы */
      tone(220 + Math.random()*40, 0.06, "triangle", 0.18, 0, 180);
    },
    hop(){          /* соңғы тоқтау */
      tone(320, 0.12, "triangle", 0.24, 0, 420);
    },
    correct(){      /* дұрыс */
      tone(523.25, 0.12, "triangle", 0.28);
      tone(659.25, 0.12, "triangle", 0.28, 0.09);
      tone(783.99, 0.2,  "triangle", 0.3,  0.18);
      tone(1046.5, 0.32, "sine",    0.24, 0.27);
    },
    wrong(){        /* бұрыс */
      noise(0.32, 0.28, 500, 0);
      tone(180, 0.28, "sawtooth", 0.22, 0.02, 110);
      tone(120, 0.34, "sawtooth", 0.2, 0.1, 80);
    },
    danger(){       /* қауіп */
      tone(90, 0.5, "sawtooth", 0.3, 0, 60);
      tone(70, 0.55, "square", 0.18, 0.06, 50);
      noise(0.5, 0.18, 300, 0.02);
    },
    lifeLost(){     /* өмір күйді */
      noise(0.3, 0.3, 2500, 0);
      tone(900, 0.22, "square", 0.16, 0, 300);
    },
    victory(){      /* жеңіс */
      const mel = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
      mel.forEach((f,i)=> tone(f, 0.22, "triangle", 0.3, i*0.13));
      tone(1567.98, 0.5, "sine", 0.26, mel.length*0.13);
      noise(0.6, 0.12, 4000, mel.length*0.13 + 0.1);
    },
    turn(){         /* кезек */
      tone(440, 0.1, "triangle", 0.22);
      tone(660, 0.14, "triangle", 0.22, 0.08);
    },
    reveal(){       /* жауапты ашу */
      tone(520, 0.1, "sine", 0.2);
      tone(780, 0.16, "sine", 0.2, 0.07);
    },
    dangerPass(){   /* қауіптен өтті */
      tone(659.25, 0.12, "triangle", 0.26);
      tone(880,   0.16, "triangle", 0.26, 0.1);
      tone(1174.6, 0.24, "triangle", 0.24, 0.2);
    }
  };
})();
