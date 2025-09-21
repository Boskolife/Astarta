import fullpage from 'fullpage.js';

const video = document.getElementById('video');

// Сегменты
const SEGMENTS = [
  [2.5, 2.5], // секция 0
  [6.9, 6.9], // секция 1
  [14.85, 14.85], // секция 2
  [18.4, 18.4], // секция 3
  [22.1, 22.1], // секция 4
  [26.34, 26.34], // секция 5
  [26.65, 26.65], // секция 6
];

const VIDEO_SEGMENTS = [
  [2.5, 2.5], // секция 0
  [2.5, 6.9], // 0→1
  [6.9, 6.9], // секция 1
  [6.9, 14.85], // 1→2
  [14.85, 14.85], // секция 2
  [14.85, 18.4], // 2→3
  [18.4, 18.4], // секция 3
  [18.4, 22.1], // 3→4
  [22.1, 22.1], // секция 4
  [22.1, 26.34], // 4→5
  [26.34, 26.34], // секция 5
  [26.34, 26.65], // 5→6
  [26.65, 26.65], // секция 6
];

// Функция проигрывания сегмента
function playVideoSegment(start, end) {
  video.currentTime = start;
  video.play();

  function checkTime() {
    if (video.currentTime >= end) {
      video.pause();
      video.removeEventListener('timeupdate', checkTime);
    }
  }

  video.addEventListener('timeupdate', checkTime);
}

// Инициализация fullPage.js
new fullpage('#fullpage', {
  autoScrolling: true,
  navigation: true,
  onLeave: function (origin, destination, direction) {
    const fromIndex = origin.index;
    const toIndex = destination.index;

    let segmentIndex;
    // Переход между секциями
    if (direction === 'down') {
      segmentIndex = toIndex * 2 - 1; // промежуточный сегмент вниз
    } else {
      segmentIndex = fromIndex * 2; // промежуточный сегмент вверх
    }

    // Если есть промежуточный сегмент → проигрываем его
    if (VIDEO_SEGMENTS[segmentIndex]) {
      const [start, end] = VIDEO_SEGMENTS[segmentIndex];
      playVideoSegment(start, end);
    } else {
      // иначе сразу фиксированный сегмент секции
      const [start, end] = SEGMENTS[toIndex];
      playVideoSegment(start, end);
    }
  },
  afterLoad: function (origin, destination) {
    // После загрузки секции — фиксируем видео в её таймкоде
    const [start, end] = SEGMENTS[destination.index];
    playVideoSegment(start, end);
  },
});
