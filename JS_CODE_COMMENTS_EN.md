# 📝 JavaScript Code - Detailed Comments

## 🎯 main.js File Structure

### 1. Imports and Initialization
```javascript
import fullpage from 'fullpage.js';

// DOM elements - get references to main page elements
const $video = document.getElementById('video');                    // Main video
const $videoBackward = document.getElementById('video-backward');  // Reverse video
const $sections = document.querySelectorAll('.section');           // All page sections

// System state - variables for tracking current state
let fullPageInstance = null;              // FullPage.js instance
let currentSectionIndex = 0;              // Current active section index
let isInitialAnimationStarted = false;    // Initial animation flag
let isIntroPlaying = false;               // Intro playback flag
```

### 2. Data Configuration
```javascript
// SEGMENTS - defines when which HTML section should be visible
// Each object contains from (start) and to (end) in seconds
const SEGMENTS = [
  { from: 0, to: 5 },      // Section 0: Intro (0-5 seconds)
  { from: 5, to: 10 },     // Section 1: First section (5-10 seconds)
  { from: 10, to: 15 },    // Section 2: Second section (10-15 seconds)
  // ... other sections
];

// VIDEO_SEGMENTS - defines video time segments for each transition
// Must be synchronized with SEGMENTS
const VIDEO_SEGMENTS = [
  { from: 0, to: 5 },      // Intro video
  { from: 5, to: 10 },     // Transition 1
  { from: 10, to: 15 },    // Transition 2
  // ... other transitions
];

// Constants for optimization
const TIME_WRITE_EPSILON = 1 / 120; // Minimum threshold for currentTime updates (120 FPS)
```

---

## 🎬 Video Functions

### 1. Video Playback Preparation
```javascript
function primeVideoPlayback(video) {
  // Check video element existence
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  // Set basic properties for autoplay
  video.muted = true;        // No sound (browser requirement)
  video.playsInline = true;  // Play inside page (iOS)
  video.preload = 'auto';    // Preload video

  // Handler for first user interaction
  // This is necessary to unlock autoplay
  const handleFirstInteraction = () => {
    video.muted = false;  // Enable sound after interaction
    // Remove handlers after first use
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  };
  
  // Add handlers for click and touch
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);
}
```

### 2. Forward Video Playback
```javascript
function playVideoSegmentForward(fromIndex, toIndex, durationMs, onComplete) {
  // Check video existence
  if (!$video) return;

  // Get time segments for transition
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;

  try {
    // Stop current playback
    $video.pause();
    
    // Set start time (end of previous section)
    $video.currentTime = fromSegment.to;
    
    // Calculate time to play
    const timeToPlay = toSegment.from - fromSegment.to;
    
    // Calculate playback speed
    // Speed = video time / scroll time
    const playbackRate = timeToPlay / (durationMs / 1000);
    
    // Set speed and start playback
    $video.playbackRate = playbackRate;
    $video.play();
    
    // Stop playback after required time
    setTimeout(() => {
      try {
        $video.pause();
        // Set exact time for next section
        $video.currentTime = toSegment.from;
        // Reset playback speed
        $video.playbackRate = 1;
        
        // Call callback if provided
        if (typeof onComplete === 'function') {
          onComplete();
        }
      } catch (error) {
        console.warn('Segment completion error:', error);
      }
    }, durationMs);
    
  } catch (error) {
    console.error('Video playback error:', error);
  }
}
```

### 3. Reverse Video Playback
```javascript
function playVideoSegmentReverse(fromIndex, toIndex, durationMs, onComplete) {
  // Check both videos existence
  if (!$video || !$videoBackward) return;

  try {
    // Stop both videos
    $video.pause();
    $videoBackward.pause();
  } catch {}

  // Get time segments
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;

  // Calculate time for reverse video
  // Reverse video plays from end to beginning
  const videoDuration = $video.duration || 0;
  const backwardFromTime = videoDuration - fromSegment.to;  // Start of reverse playback
  const backwardToTime = videoDuration - toSegment.from;    // End of reverse playback

  // Function to prepare and show reverse video
  const prepareAndShowBackward = () => {
    try {
      // Set time for reverse video
      $videoBackward.currentTime = backwardFromTime;
    } catch (e) {
      console.warn('Failed to set backward video time:', e);
    }

    // Function to show reverse video when frame is ready
    const showWhenReady = () => {
      // Switch visibility: hide main, show reverse
      $video.classList.remove('is-visible');
      $videoBackward.classList.add('is-visible');

      // Start reverse video playback
      const playPromise = $videoBackward.play();
      if (playPromise && playPromise.then) {
        playPromise.catch((e) => console.warn('Backward video play error:', e));
      }
    };

    // Frame readiness handler
    const onSeeked = () => {
      $videoBackward.removeEventListener('seeked', onSeeked);
      // Check video readiness (readyState >= 2 means frame is ready)
      if ($videoBackward.readyState >= 2) {
        showWhenReady();
      } else {
        // If frame not ready yet, wait for canplay event
        const onCanPlay = () => {
          $videoBackward.removeEventListener('canplay', onCanPlay);
          showWhenReady();
        };
        $videoBackward.addEventListener('canplay', onCanPlay, { once: true });
      }
    };

    // Wait for seeked event (frame is set)
    $videoBackward.addEventListener('seeked', onSeeked, { once: true });
  };

  // Start reverse video preparation
  prepareAndShowBackward();

  // After required time, switch back to main video
  setTimeout(() => {
    try {
      $videoBackward.pause();
    } catch {}

    // Function to prepare and show main video
    const prepareAndShowMain = () => {
      try {
        // Set time for main video
        $video.currentTime = toSegment.from;
      } catch (e) {
        console.warn('Failed to sync main video time:', e);
      }

      // Function to show main video when frame is ready
      const showMainWhenReady = () => {
        // Switch visibility: hide reverse, show main
        $videoBackward.classList.remove('is-visible');
        $video.classList.add('is-visible');

        // Call callback if provided
        if (typeof onComplete === 'function') {
          try {
            onComplete();
          } catch (e) {
            console.warn('Segment completion callback error:', e);
          }
        }
      };

      // Main video frame readiness handler
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

      // Wait for seeked event for main video
      $video.addEventListener('seeked', onSeekedMain, { once: true });
    };

    // Start main video preparation
    prepareAndShowMain();
  }, durationMs);
}
```

---

## 📜 Scroll Functions

### 1. FullPage.js Initialization
```javascript
function initFullPage() {
  // Synchronize speed variable with FullPage.js settings
  let currentScrollSpeed = 1000;

  // Create FullPage.js instance
  fullPageInstance = new fullpage('#fullpage', {
    // Disable standard navigation
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,
    
    // Scroll settings
    scrollingSpeed: currentScrollSpeed,  // Base speed (will change dynamically)
    easingcss3: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Smooth animation
    
    // Disable automatic transitions
    autoScrolling: true,
    fitToSection: true,
    
    // Section change handler
    onLeave: function(origin, destination, direction) {
      console.log(`Transition: ${origin.index} → ${destination.index} (${direction})`);
      
      // Update current section index
      currentSectionIndex = destination.index;
      
      // Calculate transition duration based on video
      const durationMs = calculateScrollDuration(origin.index, destination.index);
      
      // Update FullPage scroll speed
      updateScrollSpeed(durationMs);
      
      // Play video depending on direction
      if (direction === 'down') {
        playVideoSegmentForward(origin.index, destination.index, durationMs);
      } else {
        playVideoSegmentReverse(origin.index, destination.index, durationMs);
      }
      
      // Update UI element visibility
      updateUIVisibility(destination.index, direction === 'up');
    },
    
    // After render handler
    afterRender: function () {
      console.log('FullPage rendered');
      
      // Set initial index
      currentSectionIndex = 0;
      updateUIVisibility(0, false);
      
      // Start animation for first section
      const firstSection = $sections[0];
      if (firstSection && !isInitialAnimationStarted) {
        isInitialAnimationStarted = true;
        animateSectionBlocks(firstSection);
      }
    },
    
    // Window resize handler
    afterResize: function(width, height) {
      console.log('FullPage resized', width, height);
    }
  });
}
```

### 2. Scroll Duration Calculation
```javascript
function calculateScrollDuration(fromIndex, toIndex) {
  // Get time segments for transition
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  // Check segment existence
  if (!fromSegment || !toSegment) {
    console.warn('Segments not found for indices:', fromIndex, toIndex);
    return 1000; // Return base duration
  }
  
  // Calculate time difference between sections
  const timeDifference = Math.abs(toSegment.from - fromSegment.to);
  
  // Convert seconds to milliseconds
  // 1 second video = 1000ms scroll
  const durationMs = timeDifference * 1000;
  
  console.log(`Transition duration: ${timeDifference}s (${durationMs}ms)`);
  return durationMs;
}
```

### 3. Scroll Speed Update
```javascript
function updateScrollSpeed(durationMs) {
  // Update FullPage instance speed
  if (fullPageInstance && typeof fullPageInstance.setScrollingSpeed === 'function') {
    fullPageInstance.setScrollingSpeed(durationMs);
    console.log(`Scroll speed updated: ${durationMs}ms`);
  }
  
  // Fallback for global FullPage API
  if (window.fullpage_api && typeof window.fullpage_api.setScrollingSpeed === 'function') {
    window.fullpage_api.setScrollingSpeed(durationMs);
    console.log(`Scroll speed updated (global API): ${durationMs}ms`);
  }
}
```

---

## 🎭 UI Management Functions

### 1. UI Element Visibility Update
```javascript
function updateUIVisibility(sectionIndex, isScrollingUp) {
  // Get UI elements
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  // Show/hide elements logic based on section
  if (sectionIndex === 0) {
    // First section - show all elements
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  } else if (sectionIndex === SEGMENTS.length - 1) {
    // Last section (footer) - hide all elements
    soundButtonWrap?.classList.remove('visible');
    soundButtonText?.classList.remove('visible');
    arrowDownWrap?.classList.remove('visible');
  } else {
    // Intermediate sections - show all elements
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  }
  
  console.log(`UI updated for section ${sectionIndex}`);
}
```

### 2. Hide UI for Intro
```javascript
function hideUIForIntro() {
  // Get all UI elements
  const uiElements = document.querySelectorAll('.ui-element');
  
  uiElements.forEach((element) => {
    // Save current state in data attributes
    if (element.classList.contains('visible')) {
      element.setAttribute('data-intro-visible', 'true');
    } else {
      element.setAttribute('data-intro-hidden', 'true');
    }
    
    // Hide element
    element.classList.remove('visible');
    element.classList.add('hidden');
  });
  
  console.log('UI hidden for intro');
}
```

### 3. Show UI After Intro
```javascript
function showUIAfterIntro() {
  // Get all UI elements
  const uiElements = document.querySelectorAll('.ui-element');
  
  uiElements.forEach((element) => {
    // Restore state from data attributes
    const wasVisible = element.getAttribute('data-intro-visible') === 'true';
    const wasHidden = element.getAttribute('data-intro-hidden') === 'true';
    
    // Clear data attributes
    element.removeAttribute('data-intro-visible');
    element.removeAttribute('data-intro-hidden');
    
    // Restore visibility
    if (wasVisible) {
      element.classList.add('visible');
    }
    element.classList.remove('hidden');
  });
  
  console.log('UI shown after intro');
}
```

---

## 🎬 Intro Functions

### 1. Start Intro Sequence
```javascript
function startIntroFlow() {
  // Check if intro is already playing
  if (isIntroPlaying) {
    console.log('Intro already playing');
    return;
  }
  
  isIntroPlaying = true;
  console.log('Starting intro sequence');
  
  // Hide UI elements
  hideUIForIntro();
  
  // Apply FullPage classes for scroll blocking
  applyFullpageScaffoldClasses();
  
  // Play intro video
  playIntroVideo();
}
```

### 2. Play Intro Video
```javascript
function playIntroVideo() {
  if (!$video) {
    console.error('Video element not found for intro');
    return;
  }
  
  try {
    // Set time to beginning
    $video.currentTime = 0;
    $video.playbackRate = 1; // Normal speed
    
    // Start playback
    const playPromise = $video.play();
    
    if (playPromise && playPromise.then) {
      playPromise.catch((error) => {
        console.error('Intro playback error:', error);
      });
    }
    
    // Intro completion handler
    const handleIntroEnd = () => {
      console.log('Intro completed');
      
      // Show UI
      showUIAfterIntro();
      
      // Remove scroll blocking classes
      removeFullpageScaffoldClasses();
      
      // Initialize FullPage
      initFullPage();
      
      // Reset flag
      isIntroPlaying = false;
    };
    
    // Add video end handler
    $video.addEventListener('ended', handleIntroEnd, { once: true });
    
  } catch (error) {
    console.error('Intro playback error:', error);
  }
}
```

### 3. Apply FullPage Classes for Scroll Blocking
```javascript
function applyFullpageScaffoldClasses() {
  // Add classes that FullPage uses for scroll blocking
  document.documentElement.classList.add('fp-enabled');
  document.body.classList.add('fp-enabled');
  
  // Add scroll blocking class
  document.body.classList.add('fp-scroll-disabled');
  
  console.log('Applied scroll blocking classes');
}
```

### 4. Remove Scroll Blocking Classes
```javascript
function removeFullpageScaffoldClasses() {
  // Remove scroll blocking classes
  document.documentElement.classList.remove('fp-enabled');
  document.body.classList.remove('fp-enabled');
  document.body.classList.remove('fp-scroll-disabled');
  
  console.log('Removed scroll blocking classes');
}
```

---

## 🔧 Helper Functions

### 1. CSS Classes Initialization
```javascript
function initializeContentClasses() {
  // Add base classes for all content blocks
  const allContentBlocks = document.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col'
  );
  
  allContentBlocks.forEach((block) => {
    block.classList.add('content-block', 'animate-out');
  });
  
  // Add base classes for UI elements
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  if (soundButtonWrap) soundButtonWrap.classList.add('ui-element');
  if (soundButtonText) soundButtonText.classList.add('ui-element');
  if (arrowDownWrap) arrowDownWrap.classList.add('ui-element');
  
  console.log('Initialized CSS classes');
}
```

### 2. Fonts Initialization
```javascript
function initFonts() {
  // Add font loading class
  document.documentElement.classList.add('fonts-loading');
  
  // Check Font Loading API support
  if ('fonts' in document) {
    // Wait for all fonts to load
    document.fonts.ready.then(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
      console.log('Fonts loaded');
    });
  } else {
    // Fallback for old browsers
    setTimeout(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
      console.log('Fonts loaded (fallback)');
    }, 100);
  }
}
```

### 3. Resource Cleanup
```javascript
function cleanup() {
  // Destroy FullPage instance
  if (fullPageInstance) {
    fullPageInstance.destroy('all');
    fullPageInstance = null;
    console.log('FullPage destroyed');
  }
  
  // Stop videos
  if ($video) {
    $video.pause();
    $video.currentTime = 0;
  }
  
  if ($videoBackward) {
    $videoBackward.pause();
    $videoBackward.currentTime = 0;
  }
  
  console.log('Resources cleaned up');
}

// Add cleanup handler on page close
window.addEventListener('beforeunload', cleanup);
```

---

## 🚀 System Initialization

### Main Initialization Function
```javascript
// Initialization on page load
window.addEventListener('load', () => {
  try {
    console.log('Starting system initialization');
    
    // 1. Initialize fonts
    initFonts();
    
    // 2. Initialize CSS classes
    initializeContentClasses();
    
    // 3. Prepare videos for playback
    primeVideoPlayback($video);
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }
    
    // 4. Initialize sound buttons
    initSoundButtons();
    
    // 5. Start intro sequence
    startIntroFlow();
    
    // 6. Make speed change function globally available
    window.setScrollSpeed = setScrollSpeed;
    console.log('Use setScrollSpeed(milliseconds) to change scroll and video speed');
    
    console.log('Initialization completed successfully');
    
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
```

---

## 📋 Key Principles

### 1. Error Handling
- All functions wrapped in try-catch blocks
- Logging of all important events
- Graceful fallback for critical functions

### 2. Performance
- Using `requestAnimationFrame` for smooth animations
- Optimized DOM manipulation
- Minimal repaints

### 3. Compatibility
- Support for old browsers
- Fallback for new APIs
- Cross-platform compatibility

### 4. Modularity
- Logic separation into individual functions
- Reusable components
- Clear separation of responsibilities

This structure ensures reliable and performant operation of the scroll-video synchronization system.
