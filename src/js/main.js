import { gsap } from 'gsap';

import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const sections = document.querySelectorAll('.section');

sections.forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    end: 'bottom 30%',
    toggleClass: { targets: section, className: 'active' },
  });
});

const SEGMENTS = [
  [0.0, 2.5],
  [2.5, 5.1],
  [5.1, 8.75],
  [8.75, 12.2],
  [12.2, 16.0],
  [16.0, 20.0],
  [20.0, 24.5],
  [24.5, 29.0],
];

const LERP_ALPHA = 0.1;

const VELOCITY_BOOST = 0.12;

const SNAP_TO_FRAME = true;
const SOURCE_FPS = 120;

function primeVideoPlayback(video) {
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  const unlock = () => {
    try {
      video.muted = true;
      const p = video.play();
      if (p && p.then) {
        p.then(() => video.pause()).catch((error) => {
          console.warn('Video play error:', error);
        });
      } else {
        video.play();
        video.pause();
      }
    } catch (error) {
      console.warn('Video playback error:', error);
    }
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('click', unlock);
  };

  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}

const $video = document.getElementById('video');
const $sections = Array.from(document.querySelectorAll('.section'));
const hud = {
  seg: document.getElementById('hud-seg'),
  prog: document.getElementById('hud-prog'),
  time: document.getElementById('hud-time'),
};

let sectionRects = [];
let lastScrollY = window.scrollY;
let scrollVel = 0;
let smoothedTime = 0;
let activeSeg = 0;
let isPageVisible = true;
let animationId = null;

function computeSectionRects() {
  sectionRects = $sections.map((el) => ({
    el,
    top: el.offsetTop,
    height: el.offsetHeight,
    bottom: el.offsetTop + el.offsetHeight,
  }));
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, v) => (v - a) / (b - a);

function detectActiveSection() {
  const y = window.scrollY + window.innerHeight / 2;
  let idx = activeSeg;
  for (let i = 0; i < sectionRects.length; i++) {
    const r = sectionRects[i];
    if (y >= r.top && y < r.bottom) {
      idx = Math.min(i, SEGMENTS.length - 1);
      break;
    }
  }
  activeSeg = idx;
}

function tick() {
  // Пропускаем анимацию если страница не видна
  if (!isPageVisible) {
    animationId = requestAnimationFrame(tick);
    return;
  }

  try {
    const dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scrollVel = lerp(scrollVel, dy, 0.25);

    detectActiveSection();

    const r = sectionRects[activeSeg];
    const y = window.scrollY;
    let local = 0;
    if (r && r.height > 0) {
      local = clamp(invlerp(r.top, r.bottom, y + window.innerHeight / 2), 0, 1);
    }

    const [t0, t1] = SEGMENTS[activeSeg];
    let targetTime = lerp(t0, t1, local);

    if (VELOCITY_BOOST !== 0) {
      const segLen = Math.abs(t1 - t0) || 0.001;
      const dir = Math.sign(scrollVel);
      targetTime +=
        dir * Math.min(Math.abs(scrollVel) / 1000, 1) * segLen * VELOCITY_BOOST;
      targetTime = clamp(targetTime, Math.min(t0, t1), Math.max(t0, t1));
    }

    smoothedTime = lerp(smoothedTime || t0, targetTime, LERP_ALPHA);

    if (SNAP_TO_FRAME && SOURCE_FPS > 0) {
      const step = 1 / SOURCE_FPS;
      smoothedTime = Math.round(smoothedTime / step) * step;
    }

    if ($video && $video.readyState >= 2) {
      if (!$video.seeking) {
        $video.currentTime = smoothedTime;
      }
    }

    if (hud.seg) hud.seg.textContent = String(activeSeg);
    if (hud.prog) hud.prog.textContent = local.toFixed(2);
    if (hud.time) hud.time.textContent = smoothedTime.toFixed(2);
  } catch (error) {
    console.warn('Animation tick error:', error);
  }

  animationId = requestAnimationFrame(tick);
}

function loadVideo() {
  if ($video && $video.readyState < 2) {
    $video.load();
  }
}

$video.addEventListener('loadedmetadata', () => {
  const dur = $video.duration || 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    SEGMENTS[i][0] = clamp(SEGMENTS[i][0], 0, dur);
    SEGMENTS[i][1] = clamp(SEGMENTS[i][1], 0, dur);
  }
  smoothedTime = SEGMENTS[0][0] || 0;
});

document.addEventListener('scroll', loadVideo, { once: true, passive: true });
document.addEventListener('click', loadVideo, { once: true });
document.addEventListener('touchstart', loadVideo, {
  once: true,
  passive: true,
});

window.addEventListener(
  'resize',
  () => {
    computeSectionRects();
  },
  { passive: true },
);

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
});

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

window.addEventListener('beforeunload', cleanup);

function initSoundButtons() {
  const soundButtons = document.querySelectorAll('.toggle-sound');
  let isSoundOn = false;

  soundButtons.forEach((button) => {
    button.addEventListener('click', () => {
      isSoundOn = !isSoundOn;
      const span = button.querySelector('span');
      if (span) {
        span.textContent = isSoundOn ? 'Sound Off' : 'Sound On';
      }

      if ($video) {
        $video.muted = !isSoundOn;
      }
    });
  });
}

window.addEventListener('load', () => {
  try {
    computeSectionRects();
    primeVideoPlayback($video);
    initSoundButtons();
    animationId = requestAnimationFrame(tick);
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
