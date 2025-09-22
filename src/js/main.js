import fullpage from 'fullpage.js';

// СИСТЕМА ДВОЙНЫХ СЕГМЕНТОВ:
// SEGMENTS - управляют появлением секций HTML (data-seg атрибуты)
// VIDEO_SEGMENTS - управляют воспроизведением видео (currentTime)

// Сегменты для управления появлением секций HTML
const SEGMENTS = [
  [4.6, 4.6], // Секция 0 (data-seg="0")
  [7.0, 7.0], // Секция 1 (data-seg="1")
  [15.3, 15.3], // Секция 2 (data-seg="2")
  [18.3, 18.3], // Секция 3 (data-seg="3")
  [22.25, 22.25], // Секция 4 (data-seg="4")
  [26.34, 26.34], // Секция 5 (data-seg="5")
  [29.4, 29.4], // Секция 6 (data-seg="6")
  [29.7, 29.7], // Секция 7 (data-seg="7")
];

// Сегменты для управления воспроизведением видео (с промежуточными сегментами между каждой секцией кроме 5→6)
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
  [22.25, 27.45], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 4→5)
  [27.45, 27.45], // Видео сегмент 5: 26.34 - 26.34 сек (секция 5)
  [27.45, 29.0], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 5→6)
  [29.0, 29.0], // Видео сегмент 6: 29.4 - 29.4 сек (секция 6)
  [29.0, 29.7], // Промежуточный сегмент: 22.1 - 26.34 сек (переход 6→7)
  [29.7, 29.7], // Видео сегмент 7: 29.4 - 29.4 сек (секция 7)
];

// Настройки для видео
const TIME_WRITE_EPSILON = 1 / 120; // минимальный порог обновления currentTime

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
const $videoBackward = document.getElementById('video-backward');
const $sections = Array.from(document.querySelectorAll('.fp-section'));

// Основные переменные
let fullPageInstance = null;
let currentSectionIndex = 0;
let isTransitioning = false;
let returningFromFooter = false;
let scrollingSpeed = 2500;
let segmentStopRafId = null;
let isIntroPlayed = false;
let introClickHandler = null;
let introPointerHandler = null;
let introPauseHandler = null;

// Флаг для предотвращения двойной инициализации анимации
let isInitialAnimationStarted = false;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Функция для последовательного появления блоков в секции
function animateSectionBlocks(section) {
  if (!section) return;

  // Полностью пропускаем анимацию для секции с формой
  if (section.classList.contains('seventh-section')) {
    console.log('Skipping animation for form section');
    return;
  }

  // Находим блоки контента в правильном порядке:
  // 1. number_wrap (если есть)
  // 2. middle_col (если есть)
  // 3. затем все параграфы по порядку
  // 4. затем form_wrap (если есть)
  const numberWrap = section.querySelector('.number_wrap');
  const middleCol = section.querySelector('.middle_col');
  const paragraphs = Array.from(section.querySelectorAll('p'));
  const formWrap = section.querySelector('.form_wrap');
  
  // Собираем все блоки в правильном порядке
  const contentBlocks = [];
  if (numberWrap) contentBlocks.push(numberWrap);
  if (middleCol) contentBlocks.push(middleCol);
  contentBlocks.push(...paragraphs);
  if (formWrap) contentBlocks.push(formWrap);

  if (contentBlocks.length === 0) return;

  console.log(
    `Animating ${contentBlocks.length} blocks in section ${section.getAttribute(
      'data-seg',
    )}`,
  );


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
      
      console.log(
        `Animating block ${blockIndex + 1}/${contentBlocks.length}:`,
        block.tagName,
        block.className,
      );
      
      block.classList.remove('animate-out');
      block.classList.add('animate-in');
      blockIndex++;

      if (blockIndex < contentBlocks.length) {
        // Продолжаем показывать следующий блок
        setTimeout(showNextBlock, BLOCK_ANIMATION_DELAY);
      } else {
        // После показа всех блоков сразу запускаем анимацию печати для серого текста
          startTypingAnimation(section);
      }
    }
  };

  // Запускаем анимацию сразу без задержки
  showNextBlock();
}

// Функция для запуска анимации печати после появления всех блоков
function startTypingAnimation(section) {
  const grayTexts = section.querySelectorAll('.gray_text');
  
  if (grayTexts.length === 0) return;
  
  // Сбрасываем все анимации
  grayTexts.forEach((grayText) => {
    resetTypingAnimation(grayText);
  });
  
  // Запускаем анимацию последовательно для каждого элемента
  let currentIndex = 0;
  const animateNextGrayText = () => {
    if (currentIndex < grayTexts.length) {
      const grayText = grayTexts[currentIndex];
      
      // Запускаем анимацию для текущего элемента
      createTypingAnimation(grayText, 50);
      
      // Вычисляем задержку до следующего элемента
      // Берем количество символов в текущем элементе и умножаем на задержку
      const textLength = grayText.textContent?.length || 0;
      const delayToNext = textLength * 50 + 1; // 200ms дополнительной паузы между элементами
      
      currentIndex++;
      
      // Запускаем следующий элемент через рассчитанную задержку
      if (currentIndex < grayTexts.length) {
        setTimeout(animateNextGrayText, delayToNext);
      }
    }
  };
  
  // Запускаем первый элемент
  animateNextGrayText();
}

// Функция для сброса анимации блоков секции
function resetSectionBlocks(section) {
  if (!section) return;

  const contentBlocks = section.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col',
  );
  contentBlocks.forEach((block) => {
    block.classList.add('content-block');
    block.classList.remove('animate-in');
    block.classList.add('animate-out');
  });
}

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 100) {
  if (!element) return;

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

  // Затем последовательно активируем символы с задержкой
  charElements.forEach((charEl, index) => {
    setTimeout(() => {
      charEl.classList.add('active');
    }, index * delay);
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

// Ранее использовалась проверка переходных сегментов — больше не нужна

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

  // Для отладки лог
  console.log(
    `Video segment play: ${fromT0}s -> ${toT0}s over ${scrollingSpeed}ms`,
  );
}

// Воспроизвести участок видео с заданной длительностью, без постоянного currentTime-синка
function playVideoSegment(fromTime, toTime, durationMs, onComplete) {
  if (!$video) return;

  // Остановить предыдущий мониторинг, если есть
  if (segmentStopRafId) {
    cancelAnimationFrame(segmentStopRafId);
    segmentStopRafId = null;
  }

  const forward = toTime >= fromTime;
  const delta = Math.max(0.0001, Math.abs(toTime - fromTime));
  const durationSec = Math.max(0.2, durationMs / 1000);
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
      const shouldStopByTime = elapsed >= durationMs - 8; // небольшой люфт
      const t = $video.currentTime || 0;
      const reached = t >= toTime - TIME_WRITE_EPSILON;

      if (shouldStopByTime || reached) {
        try {
          $video.pause();
        } catch {}
        $video.playbackRate = 1;
        try {
          if (
            Math.abs(($video.currentTime || 0) - toTime) > TIME_WRITE_EPSILON
          ) {
            $video.currentTime = toTime;
          }
        } catch {}
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

// Скрыть интерфейс для интро
function hideUIForIntro() {
  // Скрываем все элементы интерфейса, кроме видео, помечая их для последующего восстановления
  const bodyChildren = Array.from(document.body.children);
  bodyChildren.forEach((el) => {
    if (el === $video) return;

    // Сохраняем текущие классы видимости перед скрытием
    const hasVisible = el.classList.contains('visible');
    const hasHidden = el.classList.contains('hidden');

    el.setAttribute('data-intro-visible', hasVisible ? '1' : '0');
    el.setAttribute('data-intro-hidden', hasHidden ? '1' : '0');

    // Скрываем элемент
    el.classList.add('hidden');
    el.classList.remove('visible');
    el.setAttribute('data-intro-hidden', '1');
  });
}

// Показать интерфейс после интро
function showUIAfterIntro() {
  // Восстанавливаем только те элементы, которые скрыли для интро
  const hiddenEls = document.querySelectorAll('[data-intro-hidden="1"]');
  hiddenEls.forEach((el) => {
    // Теперь элементы по умолчанию скрыты; после интро просто показываем их
    el.classList.remove('hidden');
    el.classList.add('visible');

    // Очищаем временные атрибуты
    el.removeAttribute('data-intro-visible');
    el.removeAttribute('data-intro-hidden');
  });
}

// Запуск интро при загрузке сайта
function startIntroFlow() {
  if (isIntroPlayed) return;
  if (!$video) {
    isIntroPlayed = true;
    initFullPage();
    return;
  }

  hideUIForIntro();
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

// Функция для принудительного показа элементов формы без анимации
function showFormElementsWithoutAnimation(section) {
  if (!section) return;
  
  const formWrap = section.querySelector('.form_wrap');
  const paragraphs = section.querySelectorAll('p');
  
  // Принудительно показываем все элементы формы
  if (formWrap) {
    formWrap.classList.add('animate-in');
    formWrap.classList.remove('animate-out', 'content-block');
    formWrap.style.opacity = '1';
    formWrap.style.visibility = 'visible';
  }
  
  // Показываем все параграфы
  paragraphs.forEach((p) => {
    p.classList.add('animate-in');
    p.classList.remove('animate-out', 'content-block');
    p.style.opacity = '1';
    p.style.visibility = 'visible';
  });
  
}

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
      
      // Если мы переходим из футера в секцию с формой, устанавливаем флаг
      if (
        sectionIndex === SEGMENTS.length - 2 &&
        currentSectionIndex === SEGMENTS.length - 1
      ) {
        returningFromFooter = true;
      }
    }
  }
}

// Инициализация FullPage.js
function initFullPage() {
  // Синхронизируем переменную скорости с настройками FullPage.js
  scrollingSpeed = 3000;
  
  fullPageInstance = new fullpage('#fullpage', {
    // Основные настройки
    licenseKey: 'gplv3-license', // Используем GPL лицензию
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
    fitToSectionDelay: 200, // Задержка привязки к секции (мс) - уменьшено для более отзывчивого скролла
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

      // Подгоняем длительность скролла под длительность видео между секциями
      updateScrollDurationForTransition(oldSectionIndex, newSectionIndex);

      // Запускаем синхронизированный переход видео
      startVideoTransition(oldSectionIndex, newSectionIndex);
      
      return true;
    },

    afterLoad: function (origin, destination, direction, trigger) {
      console.log('Loaded section', destination.index);
      
      isTransitioning = false;
      currentSectionIndex = destination.index;
      
      // Проверяем, возвращаемся ли мы из футера в секцию с формой
      const isReturningFromFooter =
        returningFromFooter && destination.index === SEGMENTS.length - 2;
      
      // Сбрасываем флаг возврата из футера
      returningFromFooter = false;
      
      
      // Обновляем видимость UI элементов
      updateUIVisibility(currentSectionIndex, false);
      
      // Для секции с формой принудительно показываем все элементы без анимации
      const newSection = $sections[currentSectionIndex];
      if (newSection && newSection.classList.contains('seventh-section')) {
        showFormElementsWithoutAnimation(newSection);
      }
      
      // Запускаем анимацию для новой секции
      // Избегаем двойного запуска для первой секции при инициализации
      // И пропускаем анимацию при возврате из футера в секцию с формой
      if (
        newSection &&
        !(currentSectionIndex === 0 && !isInitialAnimationStarted) &&
        !isReturningFromFooter
      ) {
        animateSectionBlocks(newSection);
      }
    },

    afterRender: function () {
      console.log('FullPage rendered');
      
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

    afterResize: function (width, height) {
      console.log('FullPage resized', width, height);
    },

    afterSlideLoad: function () {
      // Для слайдов, если будут использоваться
    },

    onSlideLeave: function () {
      // Для слайдов, если будут использоваться
    },
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
      if ($videoBackward) {
        $videoBackward.muted = !isSoundOn;
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

  // После интро видео начинается с первого сегмента секций (VIDEO_SEGMENTS[2])
  try {
    const startT = VIDEO_SEGMENTS[2] ? VIDEO_SEGMENTS[2][0] : 0;
    if ($video && $video.readyState >= 1) {
      $video.currentTime = startT;
    }
  } catch {}
});

// Обработчик загрузки метаданных обратного видео
$videoBackward?.addEventListener('loadedmetadata', () => {
  // Синхронизируем обратное видео с основным
  if ($video && $videoBackward) {
    const mainDuration = $video.duration || 0;
    const backwardDuration = $videoBackward.duration || 0;
    
    // Проверяем, что длительности совпадают
    if (Math.abs(mainDuration - backwardDuration) > 0.1) {
      console.warn('Video durations mismatch:', mainDuration, backwardDuration);
    }
  }
});

// Обработчики для загрузки видео
document.addEventListener('click', loadVideo, { once: true });
document.addEventListener('touchstart', loadVideo, {
  once: true,
  passive: true,
});

// Добавляем обработчик для кнопки в хедере
document.addEventListener('click', handleHeaderButtonClick);


// Функция очистки
function cleanup() {

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
  const allContentBlocks = document.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col',
  );
  allContentBlocks.forEach((block) => {
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
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }
    initSoundButtons();
    // Стартуем интро, а инициализацию FullPage выполним после его завершения
    startIntroFlow();
    
    // Делаем функцию изменения скорости доступной глобально
    window.setScrollSpeed = setScrollSpeed;
    console.log(
      'Use setScrollSpeed(milliseconds) to change scroll and video speed',
    );
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
