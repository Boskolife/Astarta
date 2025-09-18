import { gsap } from 'gsap';

import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const video = document.getElementById('bg-video');

video.addEventListener('loadedmetadata', () => {
  // Привязываем продолжительность видео к длине скролла
  gsap.to(video, {
    currentTime: video.duration,
    ease: 'none',
    scrollTrigger: {
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true, // позволяет управлять временем видео при скролле
    },
  });
});
