import fullpage from 'fullpage.js';

// Конфигурация приложения
const CONFIG = {
  SCROLLING_SPEED: {
    DEFAULT: 3000,
    QUICK_JUMP: 1500
  },
  VIDEO_SYNC: {
    EPSILON: 1 / 120,
    MIN_DURATION: 0.2
  },
  ANIMATION: {
    TYPING_DELAY: 50,
    SECTION_TRANSITION: 200,
    FONT_LOADING_FALLBACK: 100
  },
  AUDIO: {
    DRUMS_START_DELAY: 2000
  }
};

// Сегменты для управления появлением секций HTML
const SEGMENTS = [
  [4.6, 4.6], // Секция 0 (data-seg="0")
  [7.0, 7.0], // Секция 1 (data-seg="1")
  [15.3, 15.3], // Секция 2 (data-seg="2")
  [18.3, 18.3], // Секция 3 (data-seg="3")
  [22.25, 22.25], // Секция 4 (data-seg="4")
  [29.4, 29.4], // Секция 6 (data-seg="6") 
  // [26.34, 26.34], // Секция 5 (data-seg="5")
  // [29.7, 29.7], // Секция 7 (data-seg="7")
];

// Сегменты для управления воспроизведением видео
const VIDEO_SEGMENTS = [
  [0, 4.6], //  Интро
  [4.6, 4.6], // Видео сегмент 0: 4.6 - 4.6 сек (секция 0)
  [4.6, 7.0], // Промежуточный сегмент: 2.5 - 6.9 сек (переход 0→1)
  [7.0, 7.0], // Видео сегмент 1: 7.8 - 7.8 сек (секция 1)
  [7.0, 15.3], // Промежуточный сегмент: 6.9 - 14.85 сек (переход 1→2)
  [15.3, 15.3], // Видео сегмент 2: 15.3 - 15.3 сек (секция 2)
  [15.3, 18.3], // Промежуточный сегмент: 14.85 - 18.4 сек (переход 2→3)
  [18.3, 18.3], // Видео сегмент 3: 18.3 - 22.25 сек (секция 3)
  [18.3, 22.25], // Промежуточный сегмент: 18.4 - 22.1 сек (переход 3→4)
  [22.25, 22.25], // Видео сегмент 4: 22.25 - 22.25 сек (секция 4)
  [22.25, 29.4], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 4→5)
  [29.4, 29.4], // Видео сегмент 5: 26.34 - 26.34 сек (секция 5)
  // [27.45, 29.7], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 5→6)
  // [29.0, 29.0], // Видео сегмент 6: 29.4 - 29.4 сек (секция 6)
  // [29.0, 29.7], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 6→7)
  // [29.7, 29.7], // Видео сегмент 7: 29.4 - 29.4 сек (секция 7)
];

const TIME_WRITE_EPSILON = CONFIG.VIDEO_SYNC.EPSILON;
const TYPING_ANIMATION_DELAY = CONFIG.ANIMATION.TYPING_DELAY;

/**
 * Подготавливает видео для воспроизведения после пользовательского взаимодействия
 * @param {HTMLVideoElement} video - Элемент видео для подготовки
 */
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

/**
 * Принудительно загружает видео без ожидания пользовательского взаимодействия
 * @param {HTMLVideoElement} video - Элемент видео для загрузки
 */
function loadVideoImmediately(video) {
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  try {
    video.muted = true;
    // Принудительно загружаем видео
    video.load();

    // Пытаемся запустить и сразу остановить для инициализации
    const p = video.play();
    if (p && p.then) {
      p.then(() => {
        video.pause();
        video.currentTime = 0;
      }).catch((error) => {
        console.warn('Video play error:', error);
      });
    } else {
      video.play();
      video.pause();
      video.currentTime = 0;
    }
  } catch (error) {
    console.warn('Video playback error:', error);
  }
}

const $video = document.getElementById('video');
const $videoBackward = document.getElementById('video-backward');
const $audioMain = document.getElementById('audio-main');
const $audioDrums = document.getElementById('audio-drums');
const $sections = Array.from(document.querySelectorAll('.fp-section'));

let fullPageInstance = null;
let currentSectionIndex = 0;
let isTransitioning = false;
let scrollingSpeed = CONFIG.SCROLLING_SPEED.DEFAULT;
let segmentStopRafId = null;
let isIntroPlayed = false;
let introClickHandler = null;
let introPointerHandler = null;
let introPauseHandler = null;
let drumsStartTimer = null;

let isInitialAnimationStarted = false;
let isQuickJumpToForm = false;

// Хранилище для event listeners для последующей очистки
const eventListeners = new Map();

// Убрали определение мобильных устройств - больше не нужно для синхронизации видео

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Анимирует последовательное появление блоков в секции
 * @param {HTMLElement} section - Секция для анимации
 */
function animateSectionBlocks(section) {
  if (!section) return;

  // if (section.classList.contains('seventh-section')) {
  //   return;
  // }
  const numberWrap = section.querySelector('.number_wrap');
  const middleCol = section.querySelector('.middle_col');
  const paragraphs = Array.from(section.querySelectorAll('p'));
  const formWrap = section.querySelector('.form_wrap');

  const contentBlocks = [];
  if (numberWrap) contentBlocks.push(numberWrap);
  if (middleCol) contentBlocks.push(middleCol);
  contentBlocks.push(...paragraphs);
  if (formWrap) contentBlocks.push(formWrap);

  if (contentBlocks.length === 0) return;

  contentBlocks.forEach((block) => {
    block.classList.add('animate', 'hide');
    block.classList.remove('show');
  });

  contentBlocks.forEach((block) => {
    block.classList.remove('hide');
    block.classList.add('show');
  });

  startTypingAnimation(section);
}

/**
 * Запускает анимацию печати после появления всех блоков
 * @param {HTMLElement} section - Секция для анимации печати
 */
async function startTypingAnimation(section) {
  const grayTexts = section.querySelectorAll('.gray_text');

  if (grayTexts.length === 0) return;

  // Сбрасываем все анимации
  grayTexts.forEach((grayText) => {
    resetTypingAnimation(grayText);
  });

  // Запускаем анимацию последовательно для каждого элемента
  for (let i = 0; i < grayTexts.length; i++) {
    const grayText = grayTexts[i];

    // Ждем завершения анимации текущего элемента, затем сразу запускаем следующий
    await createTypingAnimation(grayText, TYPING_ANIMATION_DELAY);
  }
}

// Функция для сброса анимации блоков секции
function resetSectionBlocks(section) {
  if (!section) return;

  const contentBlocks = section.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col',
  );
  contentBlocks.forEach((block) => {
    block.classList.add('animate', 'hide');
    block.classList.remove('show');
  });
}

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 100) {
  if (!element) return Promise.resolve();

  // Если элемент ещё не подготовлен — оборачиваем символы в .char и включаем режим анимации
  if (!element.classList.contains('typing-initialized')) {
    const text = element.textContent || '';
    element.innerHTML = '';
    element.classList.add('typing-animation', 'typing-initialized');

    // Разбиваем текст на слова и пробелы
    const words = text.split(/(\s+)/);

    words.forEach((word) => {
      if (word.match(/\s+/)) {
        // Пробелы и переносы строк остаются как текстовые узлы
        element.appendChild(document.createTextNode(word));
      } else if (word.length > 0) {
        // Каждое слово оборачиваем в span
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word';

        // Разбиваем слово на буквы
        const letters = word.split('');
        letters.forEach((letter) => {
          const letterSpan = document.createElement('span');
          letterSpan.className = 'char';
          letterSpan.textContent = letter;
          wordSpan.appendChild(letterSpan);
        });

        element.appendChild(wordSpan);
      }
    });
  } else {
    // Убедимся, что класс анимации включён при старте показа
    element.classList.add('typing-animation');
  }

  // Удаляем активность со всех символов перед запуском. Пробелы/переносы остаются текстовыми узлами.
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((el) => el.classList.remove('active'));

  // Возвращаем Promise, который разрешается после завершения анимации
  return new Promise((resolve) => {
    if (charElements.length === 0) {
      resolve();
      return;
    }

    // Затем последовательно активируем символы с задержкой
    charElements.forEach((charEl, index) => {
      setTimeout(() => {
        charEl.classList.add('active');

        // Если это последний символ, разрешаем Promise
        if (index === charElements.length - 1) {
          resolve();
        }
      }, index * delay);
    });
  });
}

// Функция для сброса анимации печати
function resetTypingAnimation(element) {
  if (!element) return;
  // Не пересобираем текст, чтобы избежать скачков. Просто снимаем активность.
  const charElements = element.querySelectorAll('.char');
  if (charElements.length > 0) {
    charElements.forEach((el) => el.classList.remove('active'));
  }
  // Отключаем режим анимации до следующего старта
  element.classList.remove('typing-animation');
}

// Возвращает опорное время видео для секции (начало соответствующего видео-сегмента)
function getSectionVideoAnchorTime(sectionIndex) {
  // Секция 0 соответствует VIDEO_SEGMENTS[2], секция 1 - VIDEO_SEGMENTS[4], и т.д.
  const videoSegIndex = Math.max(
    2, // Минимум - первый сегмент после интро
    Math.min(sectionIndex * 2 + 2, VIDEO_SEGMENTS.length - 1),
  );
  const [t0] = VIDEO_SEGMENTS[videoSegIndex];
  return t0 || 0;
}

// Обновляет длительность скролла под дельту времени между секциями
function updateScrollDurationForTransition(fromSectionIndex, toSectionIndex) {
  // Если это быстрый переход к форме, не изменяем скорость
  if (isQuickJumpToForm) {
    return;
  }

  const fromT = getSectionVideoAnchorTime(fromSectionIndex);
  const toT = getSectionVideoAnchorTime(toSectionIndex);
  const deltaMs = Math.max(0, Math.round(Math.abs(toT - fromT) * 1000));

  // Минимальная длительность, чтобы избежать моментальных прыжков
  const durationMs = Math.max(200, deltaMs);

  // Сохраняем для синхронизации видео-перехода
  scrollingSpeed = durationMs;

  try {
    // Обновляем скорость у FullPage перед началом перехода
    if (
      fullPageInstance &&
      typeof fullPageInstance.setScrollingSpeed === 'function'
    ) {
      fullPageInstance.setScrollingSpeed(durationMs);
    } else if (
      window.fullpage_api &&
      typeof window.fullpage_api.setScrollingSpeed === 'function'
    ) {
      window.fullpage_api.setScrollingSpeed(durationMs);
    }
  } catch (e) {
    console.warn('Failed to set dynamic scrolling speed:', e);
  }
}

// Функция для начала плавного перехода видео между секциями
function startVideoTransition(fromSectionIndex, toSectionIndex) {
  // Если это быстрый переход к форме, не запускаем обычный переход видео
  if (isQuickJumpToForm) {
    return;
  }

  if (!$video || $video.readyState < 2) return;

  // Определяем начальный и конечный видео сегменты
  // Секция 0 соответствует VIDEO_SEGMENTS[2], секция 1 - VIDEO_SEGMENTS[4], и т.д.
  const fromVideoSegIndex = fromSectionIndex * 2 + 2;
  const toVideoSegIndex = toSectionIndex * 2 + 2;

  // Ограничиваем индексы
  const fromIndex = Math.max(
    2, // Минимум - первый сегмент после интро
    Math.min(fromVideoSegIndex, VIDEO_SEGMENTS.length - 1),
  );
  const toIndex = Math.max(
    2, // Минимум - первый сегмент после интро
    Math.min(toVideoSegIndex, VIDEO_SEGMENTS.length - 1),
  );

  const [fromT0, fromT1] = VIDEO_SEGMENTS[fromIndex];
  const [toT0, toT1] = VIDEO_SEGMENTS[toIndex];

  // Воспроизводим участок видео без постоянных записей currentTime
  playVideoSegment(fromT0, toT0, scrollingSpeed);
}

/**
 * Воспроизводит участок видео с заданной длительностью
 * @param {number} fromTime - Начальное время в секундах
 * @param {number} toTime - Конечное время в секундах
 * @param {number} durationMs - Длительность в миллисекундах
 * @param {Function} [onComplete] - Callback при завершении
 */
function playVideoSegment(fromTime, toTime, durationMs, onComplete) {
  if (!$video) return;

  console.log(
    'playVideoSegment called:',
    fromTime,
    'to',
    toTime,
    'duration:',
    durationMs,
  );

  // Остановить предыдущий мониторинг, если есть
  if (segmentStopRafId) {
    cancelAnimationFrame(segmentStopRafId);
    segmentStopRafId = null;
  }

  const forward = toTime >= fromTime;
  const delta = Math.max(0.0001, Math.abs(toTime - fromTime));
  const durationSec = Math.max(CONFIG.VIDEO_SYNC.MIN_DURATION, durationMs / 1000);
  const rate = delta / durationSec;

  try {
    // Один seek в начало отрезка
    if (Math.abs(($video.currentTime || 0) - fromTime) > TIME_WRITE_EPSILON) {
      $video.currentTime = fromTime;
    }
  } catch (e) {
    console.warn('Seek to segment start failed:', e);
  }

  const startPerf = performance.now();

  if (forward) {
    // Вперёд: используем нативное воспроизведение с ускорением
    $video.playbackRate = Math.max(0.25, Math.min(8, rate));

    const checkStopForward = () => {
      const now = performance.now();
      const elapsed = now - startPerf;
      const progress = Math.min(elapsed / durationMs, 1);

      // Убираем агрессивную синхронизацию - полагаемся на playbackRate
      // Синхронизируем только в конце для точности
      if (elapsed >= durationMs - 100) {
        const expectedTime = fromTime + (toTime - fromTime) * progress;
        try {
          $video.currentTime = expectedTime;
        } catch (e) {
          console.warn('Failed to sync video time:', e);
        }
      }

      const shouldStopByTime = elapsed >= durationMs;
      const t = $video.currentTime || 0;
      const reached = t >= toTime - TIME_WRITE_EPSILON;

      if (shouldStopByTime || reached) {
        try {
          $video.pause();
        } catch (e) {
          console.warn('Failed to pause video:', e);
        }
        $video.playbackRate = 1;
        try {
          // Принудительно устанавливаем точное время
          $video.currentTime = toTime;
          console.log(
            'Video stopped at:',
            $video.currentTime,
            'target was:',
            toTime,
          );
        } catch (e) {
          console.warn('Failed to set final video time:', e);
        }
        segmentStopRafId = null;
        if (typeof onComplete === 'function') {
          try {
            onComplete();
          } catch (e) {
            console.warn('Segment completion callback error:', e);
          }
        }
        return;
      }
      segmentStopRafId = requestAnimationFrame(checkStopForward);
    };

    const p = $video.play();
    if (p && p.then) {
      p.catch((e) => console.warn('Video play error:', e));
    }
    segmentStopRafId = requestAnimationFrame(checkStopForward);
  } else {
    // Назад: выносим логику в отдельную функцию
    playVideoSegmentReverse(fromTime, toTime, durationMs, onComplete);
  }
}

// Обратное проигрывание сегмента: подготавливаем обратное видео без мигания
function playVideoSegmentReverse(fromTime, toTime, durationMs, onComplete) {
  if (!$video || !$videoBackward) return;

  try {
    $video.pause();
    $videoBackward.pause();
  } catch {}

  // Вычисляем время в обратном видео
  const videoDuration = $video.duration || 0;
  const backwardFromTime = videoDuration - fromTime;
  const backwardToTime = videoDuration - toTime;

  // Подготавливаем обратное видео: устанавливаем время и ждем готовности
  const prepareAndShowBackward = () => {
    try {
      $videoBackward.currentTime = backwardFromTime;
    } catch (e) {
      console.warn('Failed to set backward video time:', e);
    }

    // Ждем, пока видео будет готово к показу нужного кадра
    const showWhenReady = () => {
      // Переключаем видимость только когда обратное видео готово
      $video.classList.remove('is-visible');
      $videoBackward.classList.add('is-visible');

      // Запускаем обратное видео
      const p = $videoBackward.play();
      if (p && p.then) {
        p.catch((e) => console.warn('Backward video play error:', e));
      }
    };

    // Ждем готовности видео (seeked + canplay)
    const onSeeked = () => {
      $videoBackward.removeEventListener('seeked', onSeeked);
      if ($videoBackward.readyState >= 2) {
        showWhenReady();
      } else {
        const onCanPlay = () => {
          $videoBackward.removeEventListener('canplay', onCanPlay);
          showWhenReady();
        };
        $videoBackward.addEventListener('canplay', onCanPlay, { once: true });
      }
    };

    $videoBackward.addEventListener('seeked', onSeeked, { once: true });
  };

  prepareAndShowBackward();

  // Через заданное время возвращаемся к основному видео
  setTimeout(() => {
    try {
      $videoBackward.pause();
    } catch {}

    // Подготавливаем основное видео перед показом
    const prepareAndShowMain = () => {
      try {
        $video.currentTime = toTime;
      } catch (e) {
        console.warn('Failed to sync main video time:', e);
      }

      const showMainWhenReady = () => {
        $videoBackward.classList.remove('is-visible');
        $video.classList.add('is-visible');

        if (typeof onComplete === 'function') {
          try {
            onComplete();
          } catch (e) {
            console.warn('Segment completion callback error:', e);
          }
        }
      };

      // Ждем готовности основного видео
      const onSeekedMain = () => {
        $video.removeEventListener('seeked', onSeekedMain);
        if ($video.readyState >= 2) {
          showMainWhenReady();
        } else {
          const onCanPlayMain = () => {
            $video.removeEventListener('canplay', onCanPlayMain);
            showMainWhenReady();
          };
          $video.addEventListener('canplay', onCanPlayMain, { once: true });
        }
      };

      $video.addEventListener('seeked', onSeekedMain, { once: true });
    };

    prepareAndShowMain();
  }, durationMs);
}

// Временное применение классов/стилей FullPage для <html> и <body> во время интро
function applyFullpageScaffoldClasses() {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  if (!htmlEl || !bodyEl) return;

  // Помечаем, что классы добавлены интро
  htmlEl.setAttribute('data-intro-fp-scaffold', '1');
  bodyEl.setAttribute('data-intro-fp-scaffold', '1');

  // Класс, который использует fullpage для блокировки скролла
  htmlEl.classList.add('fp-enabled');
  bodyEl.classList.add('fp-enabled');

  // Блокируем естественный скролл и растягиваем на высоту окна
  const prevHtmlOverflow = htmlEl.style.overflow;
  const prevBodyOverflow = bodyEl.style.overflow;
  const prevHtmlHeight = htmlEl.style.height;
  const prevBodyHeight = bodyEl.style.height;

  htmlEl.setAttribute('data-intro-prev-overflow', prevHtmlOverflow || '');
  bodyEl.setAttribute('data-intro-prev-overflow', prevBodyOverflow || '');
  htmlEl.setAttribute('data-intro-prev-height', prevHtmlHeight || '');
  bodyEl.setAttribute('data-intro-prev-height', prevBodyHeight || '');

  htmlEl.style.overflow = 'hidden';
  bodyEl.style.overflow = 'hidden';
  htmlEl.style.height = '100%';
  bodyEl.style.height = '100%';
}

function removeFullpageScaffoldClasses() {
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  if (!htmlEl || !bodyEl) return;

  if (htmlEl.getAttribute('data-intro-fp-scaffold') === '1') {
    htmlEl.classList.remove('fp-enabled');
    const prevOverflow = htmlEl.getAttribute('data-intro-prev-overflow') || '';
    const prevHeight = htmlEl.getAttribute('data-intro-prev-height') || '';
    htmlEl.style.overflow = prevOverflow;
    htmlEl.style.height = prevHeight;
    htmlEl.removeAttribute('data-intro-prev-overflow');
    htmlEl.removeAttribute('data-intro-prev-height');
    htmlEl.removeAttribute('data-intro-fp-scaffold');
  }

  if (bodyEl.getAttribute('data-intro-fp-scaffold') === '1') {
    bodyEl.classList.remove('fp-enabled');
    const prevOverflow = bodyEl.getAttribute('data-intro-prev-overflow') || '';
    const prevHeight = bodyEl.getAttribute('data-intro-prev-height') || '';
    bodyEl.style.overflow = prevOverflow;
    bodyEl.style.height = prevHeight;
    bodyEl.removeAttribute('data-intro-prev-overflow');
    bodyEl.removeAttribute('data-intro-prev-height');
    bodyEl.removeAttribute('data-intro-fp-scaffold');
  }
}

// Во время интро предотвращаем клики по видео и авто-возобновляем воспроизведение, если оно прервано
function attachIntroVideoGuards() {
  if (!$video) return;
  // Блокируем клики/тапы, чтобы не ставить видео на паузу
  introClickHandler = (e) => {
    if (!isIntroPlayed) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  introPointerHandler = (e) => {
    if (!isIntroPlayed) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  // Если видео каким-то образом поставилось на паузу во время интро — возобновляем
  introPauseHandler = () => {
    if (!isIntroPlayed) {
      const p = $video.play();
      if (p && p.catch) {
        p.catch(() => {});
      }
    }
  };

  $video.addEventListener('click', introClickHandler, true);
  $video.addEventListener('pointerdown', introPointerHandler, true);
  $video.addEventListener('pause', introPauseHandler, true);
}

function detachIntroVideoGuards() {
  if (!$video) return;
  if (introClickHandler) {
    $video.removeEventListener('click', introClickHandler, true);
    introClickHandler = null;
  }
  if (introPointerHandler) {
    $video.removeEventListener('pointerdown', introPointerHandler, true);
    introPointerHandler = null;
  }
  if (introPauseHandler) {
    $video.removeEventListener('pause', introPauseHandler, true);
    introPauseHandler = null;
  }
}

// Показать интерфейс после интро
function showUIAfterIntro() {
  // Показываем все UI элементы после интро
  const uiElements = document.querySelectorAll('.ui-element');
  uiElements.forEach((el) => {
    el.classList.remove('hidden');
    el.classList.add('visible');
  });

  // Также показываем хедер отдельно, если он не имеет класса ui-element
  const header = document.querySelector('.header');
  if (header && !header.classList.contains('ui-element')) {
    header.classList.remove('hidden');
    header.classList.add('visible');
  }
}

// Запуск интро при загрузке сайта
function startIntroFlow() {
  if (isIntroPlayed) return;
  if (!$video) {
    isIntroPlayed = true;
    initFullPage();
    return;
  }

  applyFullpageScaffoldClasses();
  attachIntroVideoGuards();

  // Берем первый сегмент как интро (ожидается [0, x])
  const [introStart, introEnd] = VIDEO_SEGMENTS[0] || [0, 0];
  const introDurationMs = Math.max(0, (introEnd - introStart) * 1000);

  const play = () => {
    // Играем интро на естественной скорости
    playVideoSegment(introStart, introEnd, introDurationMs || 10, () => {
      isIntroPlayed = true;
      showUIAfterIntro();
      removeFullpageScaffoldClasses();
      detachIntroVideoGuards();
      initFullPage();
    });
  };

  // Если метаданные уже есть — сразу играем; иначе дождаться
  if ($video.readyState >= 1) {
    play();
  } else {
    $video.addEventListener('loadedmetadata', play, { once: true });
  }
}

// Функция для принудительного показа элементов формы без анимации
// function showFormElementsWithoutAnimation(section) {
//   if (!section) return;

//   const formWrap = section.querySelector('.form_wrap');
//   const paragraphs = section.querySelectorAll('p');

//   // Принудительно показываем все элементы формы
//   if (formWrap) {
//     formWrap.classList.add('show');
//     formWrap.classList.remove('hide', 'animate');
//     formWrap.style.opacity = '1';
//     formWrap.style.visibility = 'visible';
//   }

//   // Показываем все параграфы
//   paragraphs.forEach((p) => {
//     p.classList.add('show');
//     p.classList.remove('hide', 'animate');
//     p.style.opacity = '1';
//     p.style.visibility = 'visible';
//   });
// }

// Функция для управления видимостью UI элементов
function updateUIVisibility(sectionIndex, isInTransition = false) {
  // Управляем видимостью sound_button_wrap
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  if (soundButtonWrap) {
    const soundButtonText = soundButtonWrap.querySelector('p');

    if (sectionIndex === SEGMENTS.length - 2) {
      // В предпоследнем сегменте (форма) скрываем только текст
      if (soundButtonText) {
        soundButtonText.classList.remove('visible');
        soundButtonText.classList.add('hidden');
      }
      soundButtonWrap.classList.remove('hidden');
      soundButtonWrap.classList.add('visible');
    } else if (sectionIndex === SEGMENTS.length - 1) {
      // В последнем сегменте (футер) скрываем всю кнопку звука
      if (soundButtonText) {
        soundButtonText.classList.remove('visible');
        soundButtonText.classList.add('hidden');
      }
      soundButtonWrap.classList.remove('visible');
      soundButtonWrap.classList.add('hidden');
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
    if (
      sectionIndex === SEGMENTS.length - 2 ||
      sectionIndex === SEGMENTS.length - 1
    ) {
      // Скрываем стрелку в предпоследней секции (форма) и в последней (футер)
      arrowDownWrap.classList.remove('visible');
      arrowDownWrap.classList.add('hidden');
    } else {
      arrowDownWrap.classList.remove('hidden');
      arrowDownWrap.classList.add('visible');
    }
  }

  // Управляем видимостью секции с формой когда мы в футере
  const formSection = document.querySelector('.seventh-section');
  if (formSection) {
    if (sectionIndex === SEGMENTS.length - 1) {
      // В футере (последняя секция) - показываем секцию с формой поверх футера
      formSection.classList.add('keep-visible');
    } else {
      // Не в футере - убираем класс keep-visible
      formSection.classList.remove('keep-visible');
    }
  }
}

// Инициализация FullPage.js
function initFullPage() {
  // Синхронизируем переменную скорости с настройками FullPage.js
  scrollingSpeed = CONFIG.SCROLLING_SPEED.DEFAULT;

  fullPageInstance = new fullpage('#fullpage', {
    // Основные настройки
    licenseKey: 'MRN18-7QE8I-60JN8-95SP9-XZTAO',
    sectionsColor: [
      'transparent',
      'transparent',
      'transparent',
      'transparent',
      'transparent',
      'transparent',
      'transparent',
      'transparent',
    ],
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,

    // Настройки скроллинга
    scrollingSpeed: scrollingSpeed, // Синхронизированная скорость перехода между секциями
    autoScrolling: true,
    fitToSection: true,
    fitToSectionDelay: CONFIG.ANIMATION.SECTION_TRANSITION, // Задержка привязки к секции (мс) - уменьшено для более отзывчивого скролла
    scrollBar: false,
    easing: 'easeInOutCubic', // Тип анимации: 'linear', 'easeInOutCubic', 'easeInOutQuart'
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
    touchSensitivity: 10, // Чувствительность тач-событий (5-100, меньше = более чувствительный)
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
    onLeave: function (origin, destination, direction, trigger) {
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

      // Управление барабанами при переходе между секциями
      if (newSectionIndex === 1) {
        // Переходим во вторую секцию - запускаем барабаны за 2 секунды до появления
        if (drumsStartTimer) {
          clearTimeout(drumsStartTimer);
        }
        drumsStartTimer = setTimeout(() => {
          startDrumsAudio();
          drumsStartTimer = null;
        }, CONFIG.AUDIO.DRUMS_START_DELAY);
      } else if (newSectionIndex === 0) {
        // Переходим обратно в первую секцию - останавливаем барабаны и отменяем таймер
        if (drumsStartTimer) {
          clearTimeout(drumsStartTimer);
          drumsStartTimer = null;
        }
        stopDrumsAudio();
      }
      // Для всех остальных секций (2, 3, 4, 5, 6) барабаны продолжают играть

      // Подгоняем длительность скролла под длительность видео между секциями
      updateScrollDurationForTransition(oldSectionIndex, newSectionIndex);

      // Запускаем синхронизированный переход видео
      startVideoTransition(oldSectionIndex, newSectionIndex);

      return true;
    },

    afterLoad: function (origin, destination, direction, trigger) {
      isTransitioning = false;
      currentSectionIndex = destination.index;

      // Обновляем видимость UI элементов
      updateUIVisibility(currentSectionIndex, false);

      // Для секции с формой принудительно показываем все элементы без анимации
      const newSection = $sections[currentSectionIndex];
      // if (newSection && newSection.classList.contains('seventh-section')) {
      //   showFormElementsWithoutAnimation(newSection);
      // }

      // Запускаем анимацию для новой секции
      // Избегаем двойного запуска для первой секции при инициализации
      if (
        newSection &&
        !(currentSectionIndex === 0 && !isInitialAnimationStarted)
      ) {
        animateSectionBlocks(newSection);
      }
    },

    afterRender: function () {
      // Инициализируем первую секцию
      currentSectionIndex = 0;
      updateUIVisibility(0, false);

      // Запускаем анимацию первой секции только один раз
      const firstSection = $sections[0];
      if (firstSection && !isInitialAnimationStarted) {
        isInitialAnimationStarted = true;
        animateSectionBlocks(firstSection);
      }
    },

    afterResize: function (width, height) {},

    afterSlideLoad: function () {
      // Для слайдов, если будут использоваться
    },

    onSlideLeave: function () {
      // Для слайдов, если будут использоваться
    },
  });
}

// Функция для инициализации аудио
function initAudio() {
  if (!$audioMain || !$audioDrums) {
    console.warn('Audio elements not found');
    return;
  }

  // Настраиваем аудио элементы
  $audioMain.loop = true;
  $audioDrums.loop = true;

  // Сбрасываем аудио в начало при перезагрузке
  $audioMain.currentTime = 0;
  $audioDrums.currentTime = 0;

  // Все аудио элементы по умолчанию muted, но запускаем их
  $audioMain.muted = true;
  $audioDrums.muted = true;

  // Видео элементы тоже muted по умолчанию
  if ($video) {
    $video.muted = true;
  }
  if ($videoBackward) {
    $videoBackward.muted = true;
  }

  // Запускаем основное аудио сразу (но muted)
  startMainAudio();
}


// Функция для запуска основного аудио
function startMainAudio() {
  if (!$audioMain) return;

  try {
    $audioMain.currentTime = 0;
    const playPromise = $audioMain.play();
    if (playPromise && playPromise.then) {
      playPromise.catch((error) => {
        console.warn('Main audio play error:', error);
      });
    }
  } catch (error) {
    console.warn('Main audio initialization error:', error);
  }
}

// Функция для запуска барабанов
function startDrumsAudio() {
  if (!$audioDrums) return;

  try {
    $audioDrums.currentTime = 0;
    const playPromise = $audioDrums.play();
    if (playPromise && playPromise.then) {
      playPromise.catch((error) => {
        console.warn('Drums audio play error:', error);
      });
    }
  } catch (error) {
    console.warn('Drums audio initialization error:', error);
  }
}

// Функция для остановки барабанов
function stopDrumsAudio() {
  if (!$audioDrums) return;

  try {
    $audioDrums.pause();
    $audioDrums.currentTime = 0;
  } catch (error) {
    console.warn('Drums audio stop error:', error);
  }
}

// Инициализация кнопок звука
function initSoundButtons() {
  const soundButtons = document.querySelectorAll('.toggle-sound');

  soundButtons.forEach((button) => {
    // Изначально звук выключен (muted = true)
    let isSoundOn = false;
    const soundWrap = button.closest('.sound_button_wrap');
    const span = button.querySelector('span');

    // Инициализация начального состояния
    if (soundWrap) {
      soundWrap.classList.add('sound-off');
    }
    if (span) {
      span.textContent = 'Sound Off';
    }

    button.addEventListener('click', () => {
      isSoundOn = !isSoundOn;

      // Обновляем текст кнопки
      if (span) {
        span.textContent = isSoundOn ? 'Sound On' : 'Sound Off';
      }

      // Переключение иконок
      if (soundWrap) {
        if (isSoundOn) {
          soundWrap.classList.remove('sound-off');
        } else {
          soundWrap.classList.add('sound-off');
        }
      }

      // Управление видео
      if ($video) {
        $video.muted = !isSoundOn;
      }
      if ($videoBackward) {
        $videoBackward.muted = !isSoundOn;
      }

      // Управление аудио
      if ($audioMain) {
        $audioMain.muted = !isSoundOn;
      }
      if ($audioDrums) {
        $audioDrums.muted = !isSoundOn;
      }
    });
  });
}

// Функция для открытия попапа с формой
function openFormPopup() {
  const popup = document.getElementById('form-popup');
  if (!popup) return;

  popup.classList.add('show');
  // Блокируем скролл, сохраняя оригинальные настройки
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Фокусируемся на первом поле формы
  const firstInput = popup.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

// Функция для закрытия попапа с формой
function closeFormPopup() {
  const popup = document.getElementById('form-popup');
  if (!popup) return;

  popup.classList.remove('show');
  // Восстанавливаем оригинальные настройки скролла
  document.body.style.overflow = '';
  document.body.style.overflowX = 'hidden'; // Восстанавливаем overflow-x: hidden
  document.documentElement.style.overflow = '';

  // Сбрасываем форму
  const form = popup.querySelector('#contact-form');
  if (form) {
    form.reset();
  }
}

// Инициализация кнопки Contact us
function initContactUsButton() {
  const contactUsButton = document.querySelector(
    '.header_button[href="#form"]',
  );

  if (contactUsButton) {
    contactUsButton.addEventListener('click', (e) => {
      e.preventDefault(); // Предотвращаем стандартное поведение ссылки
      openFormPopup(); // Открываем попап вместо скролла к секции
      // quickJumpToForm(); // Закомментировано - скролл к секции
    });
  }
}

// Инициализация попапа с формой
function initFormPopup() {
  const popup = document.getElementById('form-popup');
  if (!popup) return;

  // Кнопка закрытия
  const closeButton = popup.querySelector('.form-popup-close');
  if (closeButton) {
    closeButton.addEventListener('click', closeFormPopup);
  }

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup.classList.contains('show')) {
      closeFormPopup();
    }
  });
}

// Обработчик загрузки метаданных видео
const handleVideoMetadata = () => {
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

  // После интро видео начинается с первого сегмента секций (VIDEO_SEGMENTS[2])
  try {
    const startT = VIDEO_SEGMENTS[2] ? VIDEO_SEGMENTS[2][0] : 0;
    if ($video && $video.readyState >= 1) {
      $video.currentTime = startT;
    }
  } catch {}
};

$video?.addEventListener('loadedmetadata', handleVideoMetadata);
eventListeners.set('video-metadata', { element: $video, event: 'loadedmetadata', handler: handleVideoMetadata });

// Обработчик загрузки метаданных обратного видео
const handleBackwardVideoMetadata = () => {
  // Синхронизируем обратное видео с основным
  if ($video && $videoBackward) {
    const mainDuration = $video.duration || 0;
    const backwardDuration = $videoBackward.duration || 0;

    // Проверяем, что длительности совпадают
    if (Math.abs(mainDuration - backwardDuration) > 0.1) {
      console.warn('Video durations mismatch:', mainDuration, backwardDuration);
    }
  }
};

$videoBackward?.addEventListener('loadedmetadata', handleBackwardVideoMetadata);
eventListeners.set('backward-video-metadata', { element: $videoBackward, event: 'loadedmetadata', handler: handleBackwardVideoMetadata });

// Обработчики ошибок для видео
const handleVideoError = (e) => {
  console.error('Main video error:', e);
};

const handleBackwardVideoError = (e) => {
  console.error('Backward video error:', e);
};

$video?.addEventListener('error', handleVideoError);
$videoBackward?.addEventListener('error', handleBackwardVideoError);

eventListeners.set('video-error', { element: $video, event: 'error', handler: handleVideoError });
eventListeners.set('backward-video-error', { element: $videoBackward, event: 'error', handler: handleBackwardVideoError });



/**
 * Очищает все event listeners для предотвращения утечек памяти
 */
function cleanupEventListeners() {
  eventListeners.forEach(({ element, event, handler }) => {
    if (element && handler) {
      element.removeEventListener(event, handler);
    }
  });
  eventListeners.clear();
}

/**
 * Функция очистки ресурсов
 */
function cleanup() {
  // Очищаем event listeners
  cleanupEventListeners();
  
  if (fullPageInstance) {
    fullPageInstance.destroy('all');
    fullPageInstance = null;
  }

  // Очищаем таймер барабанов
  if (drumsStartTimer) {
    clearTimeout(drumsStartTimer);
    drumsStartTimer = null;
  }

  // Останавливаем и сбрасываем все аудио
  if ($audioMain) {
    $audioMain.pause();
    $audioMain.currentTime = 0;
  }
  if ($audioDrums) {
    $audioDrums.pause();
    $audioDrums.currentTime = 0;
  }
}

window.addEventListener('beforeunload', cleanup);

// Функция для быстрого перехода к секции формы
function quickJumpToForm() {
  if (!fullPageInstance) return;

  // Определяем индекс секции с формой (седьмая секция, индекс 6)
  const formSectionIndex = 6;

  // Если мы уже в секции с формой, ничего не делаем
  if (currentSectionIndex === formSectionIndex) return;

  // Проверяем, что FullPage полностью инициализирован
  if (!fullPageInstance.moveTo) {
    console.warn('FullPage not fully initialized');
    return;
  }

  // Устанавливаем флаги быстрого перехода
  isTransitioning = true;
  isQuickJumpToForm = true;

  // Сбрасываем анимации для текущей секции
  const currentSection = $sections[currentSectionIndex];
  if (currentSection) {
    resetSectionBlocks(currentSection);
    const grayTexts = currentSection.querySelectorAll('.gray_text');
    grayTexts.forEach((grayText) => {
      resetTypingAnimation(grayText);
    });
  }

  // Устанавливаем очень быструю скорость для перехода к форме
  // Обходим логику updateScrollDurationForTransition для мгновенного перехода
  const originalScrollingSpeed = scrollingSpeed;
  scrollingSpeed = CONFIG.SCROLLING_SPEED.QUICK_JUMP; // Очень быстрый переход

  // Обновляем скорость через систему FullPage напрямую
  if (fullPageInstance.setScrollingSpeed) {
    fullPageInstance.setScrollingSpeed(CONFIG.SCROLLING_SPEED.QUICK_JUMP);
  }

  // Устанавливаем видео в нужное время для секции формы без воспроизведения
  if ($video && $video.readyState >= 2) {
    try {
      const formVideoTime = getSectionVideoAnchorTime(formSectionIndex);
      $video.currentTime = formVideoTime;
      $video.pause();
      
      // Также устанавливаем обратное видео
      if ($videoBackward) {
        const videoDuration = $video.duration || 0;
        $videoBackward.currentTime = videoDuration - formVideoTime;
        $videoBackward.pause();
      }
      
      console.log('Video set to form section time:', formVideoTime);
    } catch (error) {
      console.warn('Failed to set video time for form section:', error);
    }
  }

  // Мгновенно переходим к секции с формой
  try {
    fullPageInstance.moveTo(formSectionIndex + 1, 0); // +1 потому что FullPage считает с 1

    // Мгновенно показываем секцию формы
    const formSection = $sections[formSectionIndex];
    if (formSection) {
      formSection.style.opacity = '1';
      formSection.style.visibility = 'visible';
      formSection.style.transition = ''; // Убираем анимацию для мгновенного появления
    }

    // Восстанавливаем оригинальные настройки сразу
    scrollingSpeed = originalScrollingSpeed;
    if (fullPageInstance && fullPageInstance.setScrollingSpeed) {
      fullPageInstance.setScrollingSpeed(originalScrollingSpeed);
    }

    // Сбрасываем флаг быстрого перехода
    isQuickJumpToForm = false;
  } catch (error) {
    console.warn('Quick jump to form failed:', error);
    isTransitioning = false;
    isQuickJumpToForm = false;
  }
}

// Функция для инициализации базовых CSS классов
function initializeContentClasses() {
  // Добавляем базовые классы для всех контентных блоков
  const allContentBlocks = document.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col',
  );
  allContentBlocks.forEach((block) => {
    // Исключаем уведомление о звуке
    if (!block.closest('.audio-notification')) {
      block.classList.add('animate', 'hide');
    }
  });

  // Добавляем базовые классы для UI элементов
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  const header = document.querySelector('.header');

  if (soundButtonWrap) soundButtonWrap.classList.add('ui-element');
  if (soundButtonText) soundButtonText.classList.add('ui-element');
  if (arrowDownWrap) arrowDownWrap.classList.add('ui-element');
  if (header) header.classList.add('ui-element');
}

// Инициализация шрифтов
function initFonts() {
  // Добавляем класс загрузки шрифтов
  document.documentElement.classList.add('fonts-loading');

  // Проверяем загрузку шрифтов
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
    });
  } else {
    // Fallback для старых браузеров
    setTimeout(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
    }, CONFIG.ANIMATION.FONT_LOADING_FALLBACK);
  }
}

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
  try {
    // Загружаем оба видео сразу без ожидания взаимодействия
    loadVideoImmediately($video);
    if ($videoBackward) {
      loadVideoImmediately($videoBackward);
    }

    // Также устанавливаем обработчики для пользовательского взаимодействия
    primeVideoPlayback($video);
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }

    // Инициализируем аудио
    initAudio();

    // Инициализируем шрифты
    initFonts();

    // Инициализируем CSS классы до запуска FullPage
    initializeContentClasses();

    // Инициализируем кнопки звука
    initSoundButtons();

    // Инициализируем кнопку Contact us
    initContactUsButton();

    // Инициализируем попап с формой
    initFormPopup();

    // Стартуем интро, а инициализацию FullPage выполним после его завершения
    startIntroFlow();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
