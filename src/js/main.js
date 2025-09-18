import { gsap } from "gsap";
    
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const sections = document.querySelectorAll('.section');

sections.forEach(section => {
  ScrollTrigger.create({
    trigger: section,
    start: "top 30%",    // когда верх секции достигнет 60% от высоты окна
    end: "bottom 60%",   // когда низ секции пройдет 40% от высоты окна
    toggleClass: {targets: section, className: "active"},
    // markers: true // включи, если хочешь видеть позиции триггеров
  });
});

new ScrollyVideo({
    scrollyVideoContainer: "scrolly-video",
    src: "./video/astarta-fixed-2.mp4"
  });

