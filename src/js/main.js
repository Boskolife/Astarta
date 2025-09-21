import fullpage from 'fullpage.js';

// СИСТЕМА ДВОЙНЫХ СЕГМЕНТОВ:
// SEGMENTS - управляют появлением секций HTML (data-seg атрибуты)
// VIDEO_SEGMENTS - управляют воспроизведением видео (currentTime)

// Сегменты для управления появлением секций HTML
const SEGMENTS = [
  [2.5, 2.5], // Секция 0 (data-seg="0")
  [6.9, 6.9], // Секция 1 (data-seg="1")
  [14.85, 14.85], // Секция 2 (data-seg="2")
  [18.4, 18.4], // Секция 3 (data-seg="3")
  [22.1, 22.1], // Секция 4 (data-seg="4")
  [26.34, 26.34], // Секция 5 (data-seg="5")
  [26.65, 26.65], // Секция 6 (data-seg="6")
];

// Сегменты для управления воспроизведением видео (с промежуточными сегментами между каждой секцией кроме 5→6)
const VIDEO_SEGMENTS = [
  [2.5, 2.5], // Видео сегмент 0: 2.5 - 2.5 сек (секция 0)
  [2.5, 6.9], // Промежуточный сегмент: 2.5 - 6.9 сек (переход 0→1)
  [6.9, 6.9], // Видео сегмент 1: 6.9 - 6.9 сек (секция 1)
  [6.9, 14.85], // Промежуточный сегмент: 6.9 - 14.85 сек (переход 1→2)
  [14.85, 14.85], // Видео сегмент 2: 14.85 - 14.85 сек (секция 2)
  [14.85, 18.4], // Промежуточный сегмент: 14.85 - 18.4 сек (переход 2→3)
  [18.4, 18.4], // Видео сегмент 3: 18.4 - 18.4 сек (секция 3)
  [18.4, 22.1], // Промежуточный сегмент: 18.4 - 22.1 сек (переход 3→4)
  [22.1, 22.1], // Видео сегмент 4: 22.1 - 22.1 сек (секция 4)
  [22.1, 26.34], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 4→5)
  [26.34, 26.34], // Видео сегмент 5: 26.34 - 26.34 сек (секция 5)
  [26.34, 26.65], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 5→6)
  [26.65, 26.65], // Видео сегмент 6: 26.34 - 26.34 сек (секция 6)
];

const LERP_ALPHA = 0.1;
const VELOCITY_BOOST = 0.12;
const SNAP_TO_FRAME = true;
const SOURCE_FPS = 120;

// Настройки анимации блоков в секциях
const BLOCK_ANIMATION_DELAY = 300; // Задержка между появлением блоков (мс) - увеличено для более заметного эффекта

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
const $sections = Array.from(document.querySelectorAll('.fp-section'));

// FullPage.js и видео переменные
let fullPageInstance = null;
let currentSectionIndex = 0;
let isTransitioning = false;
let animationId = null;
let isPageVisible = true;
let smoothedTime = 0;
let targetTime = 0;

// Переменные для синхронизации видео с скроллом
let scrollingSpeed = 2500; // Скорость скролла (будет синхронизирована с FullPage.js)
let videoTransitionStartTime = 0;
let videoTransitionStartValue = 0;
let videoTransitionEndValue = 0;
let videoTransitionDuration = 0;

// Флаг для предотвращения двойной инициализации анимации
let isInitialAnimationStarted = false;

// Переменные для управления анимацией
let sectionAnimationTimeout = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Функция для последовательного появления блоков в секции
function animateSectionBlocks(section) {
  if (!section) return;

  // Находим блоки контента в правильном порядке:
  // 1. Сначала number_wrap (если есть)
  // 2. Затем все параграфы по порядку
  // 3. Затем form_wrap (если есть)
  const numberWrap = section.querySelector('.number_wrap');
  const paragraphs = Array.from(section.querySelectorAll('p'));
  const formWrap = section.querySelector('.form_wrap');
  
  // Собираем все блоки в правильном порядке
  const contentBlocks = [];
  if (numberWrap) contentBlocks.push(numberWrap);
  contentBlocks.push(...paragraphs);
  if (formWrap) contentBlocks.push(formWrap);

  if (contentBlocks.length === 0) return;

  console.log(`Animating ${contentBlocks.length} blocks in section ${section.getAttribute('data-seg')}`);

  // Добавляем базовый класс и сбрасываем состояние
  contentBlocks.forEach((block, index) => {
    block.classList.add('content-block');
    block.classList.remove('animate-in');
    block.classList.add('animate-out');
    
    // Добавляем индекс для отладки
    block.setAttribute('data-animation-index', index);
  });

  // Показываем блоки последовательно
  let blockIndex = 0;
  const showNextBlock = () => {
    if (blockIndex < contentBlocks.length) {
      const block = contentBlocks[blockIndex];
      
      console.log(`Animating block ${blockIndex + 1}/${contentBlocks.length}:`, block.tagName, block.className);
      
      block.classList.remove('animate-out');
      block.classList.add('animate-in');
      blockIndex++;

      if (blockIndex < contentBlocks.length) {
        // Продолжаем показывать следующий блок
        setTimeout(showNextBlock, BLOCK_ANIMATION_DELAY);
      } else {
        // После показа всех блоков запускаем анимацию печати для серого текста
        setTimeout(() => {
          startTypingAnimation(section);
        }, 500); // Увеличенная задержка для лучшего эффекта
      }
    }
  };

  // Запускаем анимацию с начальной задержкой
  setTimeout(showNextBlock, 400);
}

// Функция для запуска анимации печати после появления всех блоков
function startTypingAnimation(section) {
  const grayTexts = section.querySelectorAll('.gray_text');
  grayTexts.forEach((grayText) => {
    // Сбрасываем предыдущую анимацию если была
    resetTypingAnimation(grayText);
    // Запускаем новую анимацию
    createTypingAnimation(grayText, 50);
  });
}

// Функция для сброса анимации блоков секции
function resetSectionBlocks(section) {
  if (!section) return;

  const contentBlocks = section.querySelectorAll('p, .form_wrap, .number_wrap');
  contentBlocks.forEach((block) => {
    block.classList.add('content-block');
    block.classList.remove('animate-in');
    block.classList.add('animate-out');
  });
}

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 100) {
  if (!element || element.classList.contains('typing-initialized')) {
    return;
  }

  const text = element.textContent;
  const chars = text.split('');

  // Очищаем содержимое и добавляем класс для анимации
  element.innerHTML = '';
  element.classList.add('typing-animation', 'typing-initialized');

  // Создаем span для каждой буквы
  chars.forEach((char, index) => {
    const charSpan = document.createElement('span');
    charSpan.className = 'char';
    charSpan.textContent = char; // Оставляем обычные пробелы для адаптивности
    element.appendChild(charSpan);
  });

  // Запускаем анимацию
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((charEl, index) => {
    setTimeout(() => {
      charEl.classList.add('active');
    }, index * delay);
  });
}

// Функция для сброса анимации печати
function resetTypingAnimation(element) {
  if (!element || !element.classList.contains('typing-initialized')) {
    return;
  }

  element.classList.remove('typing-animation', 'typing-initialized');
  const chars = Array.from(element.querySelectorAll('.char')).map(
    (char) => char.textContent,
  );
  element.innerHTML = chars.join('');
}

// Функция для определения, находимся ли мы в переходном сегменте
function isInTransitionSegment(videoSegIndex) {
  // Индексы переходных сегментов в массиве VIDEO_SEGMENTS
  const transitionSegments = [1, 3, 5, 7, 9, 11]; // Индексы переходов между секциями
  return transitionSegments.includes(videoSegIndex);
}

// Функция для начала плавного перехода видео между секциями
function startVideoTransition(fromSectionIndex, toSectionIndex) {
  if (!$video || $video.readyState < 2) return;

  // Определяем начальный и конечный видео сегменты
  const fromVideoSegIndex = fromSectionIndex * 2;
  const toVideoSegIndex = toSectionIndex * 2;
  
  // Ограничиваем индексы
  const fromIndex = Math.max(0, Math.min(fromVideoSegIndex, VIDEO_SEGMENTS.length - 1));
  const toIndex = Math.max(0, Math.min(toVideoSegIndex, VIDEO_SEGMENTS.length - 1));

  const [fromT0, fromT1] = VIDEO_SEGMENTS[fromIndex];
  const [toT0, toT1] = VIDEO_SEGMENTS[toIndex];
  
  // Устанавливаем параметры перехода
  videoTransitionStartTime = performance.now();
  videoTransitionStartValue = fromT0; // Начальное время видео
  videoTransitionEndValue = toT0; // Конечное время видео
  videoTransitionDuration = scrollingSpeed; // Продолжительность равна скорости скролла
  
  console.log(`Video transition: ${videoTransitionStartValue}s -> ${videoTransitionEndValue}s over ${videoTransitionDuration}ms`);
}

// Функция для обновления времени видео на основе текущей секции (без перехода)
function updateVideoTime(sectionIndex, progress = 0) {
  if (!$video || $video.readyState < 2) return;

  // Определяем видео сегмент на основе секции
  let videoSegIndex = sectionIndex * 2; // Каждая секция соответствует четному индексу в VIDEO_SEGMENTS
  
  // Если есть прогресс и это не последняя секция, добавляем переходный сегмент
  if (progress > 0 && sectionIndex < SEGMENTS.length - 1) {
    videoSegIndex += 1; // Переходим к переходному сегменту
  }

  // Ограничиваем индекс
  videoSegIndex = Math.max(0, Math.min(videoSegIndex, VIDEO_SEGMENTS.length - 1));

  const [t0, t1] = VIDEO_SEGMENTS[videoSegIndex];
  targetTime = lerp(t0, t1, progress);
}

// Функция для плавного обновления видео
function tick() {
  if (!isPageVisible) {
    animationId = requestAnimationFrame(tick);
    return;
  }

  try {
    // Если идет переход между секциями, используем синхронизированную анимацию
    if (isTransitioning && videoTransitionDuration > 0) {
      const currentTime = performance.now();
      const elapsed = currentTime - videoTransitionStartTime;
      const progress = Math.min(elapsed / videoTransitionDuration, 1);
      
      // Используем easing функцию для плавности (как в FullPage.js)
      const easedProgress = easeInOutCubic(progress);
      
      // Интерполируем время видео
      targetTime = lerp(videoTransitionStartValue, videoTransitionEndValue, easedProgress);
      
      // Если переход завершен, сбрасываем параметры
      if (progress >= 1) {
        videoTransitionDuration = 0;
      }
    }

    // Плавно интерполируем к целевому времени
    smoothedTime = lerp(smoothedTime || targetTime, targetTime, LERP_ALPHA);

      if (SNAP_TO_FRAME && SOURCE_FPS > 0) {
        const step = 1 / SOURCE_FPS;
        smoothedTime = Math.round(smoothedTime / step) * step;
      }

    if ($video && $video.readyState >= 2 && !$video.seeking) {
          $video.currentTime = smoothedTime;
    }
  } catch (error) {
    console.warn('Animation tick error:', error);
  }

  animationId = requestAnimationFrame(tick);
}

// Easing функция для плавных переходов (как в FullPage.js)
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Функция для изменения скорости скролла и видео
function setScrollSpeed(newSpeed) {
  scrollingSpeed = newSpeed;
  
  if (fullPageInstance) {
    // Сбрасываем флаг инициализации при пересоздании FullPage
    isInitialAnimationStarted = false;
    
    // Обновляем настройки FullPage.js
    fullPageInstance.destroy('all');
    initFullPage();
    console.log(`Scroll speed updated to: ${newSpeed}ms`);
  }
}

// Функция для управления видимостью UI элементов
function updateUIVisibility(sectionIndex, isInTransition = false) {
  // Управляем видимостью sound_button_wrap
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  if (soundButtonWrap) {
    const soundButtonText = soundButtonWrap.querySelector('p');

    if (sectionIndex === SEGMENTS.length - 1) {
      // В последнем сегменте скрываем только текст
      if (soundButtonText) {
        soundButtonText.classList.remove('visible');
        soundButtonText.classList.add('hidden');
      }
      soundButtonWrap.classList.remove('hidden');
      soundButtonWrap.classList.add('visible');
    } else {
      // В других секциях показываем всё
      if (soundButtonText) {
        soundButtonText.classList.remove('hidden');
        soundButtonText.classList.add('visible');
      }
      soundButtonWrap.classList.remove('hidden');
      soundButtonWrap.classList.add('visible');
    }
  }

  // Управляем видимостью arrow_down_wrap
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  if (arrowDownWrap) {
    if (sectionIndex === SEGMENTS.length - 1) {
      arrowDownWrap.classList.remove('visible');
      arrowDownWrap.classList.add('hidden');
    } else {
      arrowDownWrap.classList.remove('hidden');
      arrowDownWrap.classList.add('visible');
    }
  }
}

// Инициализация FullPage.js
function initFullPage() {
  // Синхронизируем переменную скорости с настройками FullPage.js
  scrollingSpeed = 2000;
  
  fullPageInstance = new fullpage('#fullpage', {
    // Основные настройки
    licenseKey: 'gplv3-license', // Используем GPL лицензию
    sectionsColor: ['transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent', 'transparent'],
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,
    
    // Настройки скроллинга
    scrollingSpeed: scrollingSpeed, // Синхронизированная скорость перехода между секциями
    autoScrolling: true,
    fitToSection: true,
    fitToSectionDelay: 200,     // Задержка привязки к секции (мс) - уменьшено для более отзывчивого скролла
    scrollBar: false,
    easing: 'easeInOutCubic',   // Тип анимации: 'linear', 'easeInOutCubic', 'easeInOutQuart'
    easingcss3: 'ease',
    loopBottom: false,
    loopTop: false,
    loopHorizontal: true,
    continuousVertical: false,
    continuousHorizontal: false,
    scrollHorizontally: false,
    interlockedSlides: false,
    dragAndMove: false,
    offsetSections: false,
    resetSliders: false,
    fadingEffect: false,
    normalScrollElements: '#form input, #form textarea, #form button',
    scrollOverflow: false,
    scrollOverflowReset: false,
    scrollOverflowOptions: null,
    touchSensitivity: 10,       // Чувствительность тач-событий (5-100, меньше = более чувствительный)
    bigSectionsDestination: null,

    // Настройки клавиатуры
    keyboardScrolling: true,
    animateAnchor: true,
    recordHistory: true,

    // Настройки меню
    menu: null,
    lazyLoading: true,
    observer: true,
    credits: { enabled: false },

    // Callbacks
    onLeave: function(origin, destination, direction, trigger) {
      console.log('Leaving section', origin.index, 'to', destination.index);
      
      isTransitioning = true;
      const oldSectionIndex = origin.index;
      const newSectionIndex = destination.index;
      
      // Сбрасываем анимации для покидаемой секции
      const oldSection = $sections[oldSectionIndex];
      if (oldSection) {
        resetSectionBlocks(oldSection);
        const grayTexts = oldSection.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      }

      // Запускаем синхронизированный переход видео
      startVideoTransition(oldSectionIndex, newSectionIndex);
      
      return true;
    },

    afterLoad: function(origin, destination, direction, trigger) {
      console.log('Loaded section', destination.index);
      
      isTransitioning = false;
      currentSectionIndex = destination.index;
      
      // Обновляем время видео для новой секции
      updateVideoTime(currentSectionIndex, 0);
      
      // Обновляем видимость UI элементов
      updateUIVisibility(currentSectionIndex, false);
      
      // Запускаем анимацию для новой секции
      // Избегаем двойного запуска для первой секции при инициализации
      const newSection = $sections[currentSectionIndex];
      if (newSection && !(currentSectionIndex === 0 && !isInitialAnimationStarted)) {
        animateSectionBlocks(newSection);
      }
    },

    afterRender: function() {
      console.log('FullPage rendered');
      
      // Инициализируем первую секцию
      currentSectionIndex = 0;
      updateVideoTime(0, 0);
      updateUIVisibility(0, false);
      
      // Запускаем анимацию первой секции только один раз
      const firstSection = $sections[0];
      if (firstSection && !isInitialAnimationStarted) {
        isInitialAnimationStarted = true;
        setTimeout(() => {
          animateSectionBlocks(firstSection);
        }, 500);
      }
    },

    afterResize: function(width, height) {
      console.log('FullPage resized', width, height);
    },

    afterSlideLoad: function(section, origin, destination, direction, trigger) {
      // Для слайдов, если будут использоваться
    },

    onSlideLeave: function(section, origin, destination, direction, trigger) {
      // Для слайдов, если будут использоваться
    }
  });
}

// Функция для загрузки видео
function loadVideo() {
  if ($video && $video.readyState < 2) {
    $video.load();
  }
}

// Функция для скролла к секции с формой
function scrollToForm() {
  if (fullPageInstance) {
    fullPageInstance.moveTo('contact');
  }
}

// Обработчик клика на кнопку в хедере
function handleHeaderButtonClick(event) {
  const target = event.target.closest('a[href="#form"], a[href="#contact"]');
  if (target) {
    event.preventDefault();
    scrollToForm();
  }
}

// Инициализация кнопок звука
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

// Обработчик загрузки метаданных видео
$video?.addEventListener('loadedmetadata', () => {
  const dur = $video.duration || 0;

  // Ограничиваем сегменты для секций
  for (let i = 0; i < SEGMENTS.length; i++) {
    SEGMENTS[i][0] = clamp(SEGMENTS[i][0], 0, dur);
    SEGMENTS[i][1] = clamp(SEGMENTS[i][1], 0, dur);
  }

  // Ограничиваем видео сегменты
  for (let i = 0; i < VIDEO_SEGMENTS.length; i++) {
    VIDEO_SEGMENTS[i][0] = clamp(VIDEO_SEGMENTS[i][0], 0, dur);
    VIDEO_SEGMENTS[i][1] = clamp(VIDEO_SEGMENTS[i][1], 0, dur);
  }

  smoothedTime = VIDEO_SEGMENTS[0][0] || 0;
  targetTime = smoothedTime;
});

// Обработчики для загрузки видео
document.addEventListener('click', loadVideo, { once: true });
document.addEventListener('touchstart', loadVideo, {
  once: true,
  passive: true,
});

// Добавляем обработчик для кнопки в хедере
document.addEventListener('click', handleHeaderButtonClick);

// Обработчик видимости страницы
document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
});

// Функция очистки
function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (fullPageInstance) {
    fullPageInstance.destroy('all');
    fullPageInstance = null;
  }

  document.removeEventListener('click', handleHeaderButtonClick);
}

window.addEventListener('beforeunload', cleanup);

// Функция для инициализации базовых CSS классов
function initializeContentClasses() {
  // Добавляем базовые классы для всех контентных блоков
  const allContentBlocks = document.querySelectorAll('p, .form_wrap, .number_wrap');
  allContentBlocks.forEach(block => {
    block.classList.add('content-block', 'animate-out');
  });
  
  // Добавляем базовые классы для UI элементов
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  if (soundButtonWrap) soundButtonWrap.classList.add('ui-element');
  if (soundButtonText) soundButtonText.classList.add('ui-element');
  if (arrowDownWrap) arrowDownWrap.classList.add('ui-element');
}

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
  try {
    // Инициализируем CSS классы до запуска FullPage
    initializeContentClasses();
    
    primeVideoPlayback($video);
    initSoundButtons();
    initFullPage();
    
    // Запускаем анимационный цикл
    animationId = requestAnimationFrame(tick);
    
    // Делаем функцию изменения скорости доступной глобально
    window.setScrollSpeed = setScrollSpeed;
    console.log('Use setScrollSpeed(milliseconds) to change scroll and video speed');
  } catch (error) {
    console.error('Initialization error:', error);
  }
});