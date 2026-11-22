// 하트레코드 사이트의 동작: 인스타그램 게시물 띠와 재생 창, 첫 화면의 녹화 시간, 상담 신청 폼, 개인정보처리방침 창.
(() => {
  'use strict';

  // 상담 신청을 받을 주소. 비어 있으면 적은 내용을 담아 방문자의 메일 앱을 연다(임시 방식).
  // 도구/상담신청_메일받기.gs 를 구글 계정에 올려서 나온 주소(https://script.google.com/macros/s/…/exec)를 여기에 적는다.
  const FORM_ENDPOINT = '';

  // 인스타그램을 위젯 서비스로 띄울 때(나 방식) 쓰는 값. 지금 것은 예전 사이트에 붙어 있던 위젯이다.
  const WIDGET = {
    script: 'https://cdn.commoninja.com/sdk/latest/commonninja.js',
    className: 'commonninja_component pid-460a81d8-1788-4370-9bbd-084c81295568',
  };

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(window.location.search);

  const ICON = {
    reel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 8.8v6.4l5.4-3.2z" fill="currentColor"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5v14L19 12z" fill="currentColor"/></svg>',
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ---------- 1. 색 조합 (기본은 낮. 주소 뒤에 ?palette=night 를 붙이면 밤 조합으로 본다) ----------
  const setPalette = (name) => {
    if (name === 'night') delete root.dataset.palette;
    else root.dataset.palette = 'day';
  };
  setPalette(params.get('palette'));

  // ---------- 2. 인스타그램 게시물 ----------
  const feed = window.HR_INSTAGRAM || { account: '', profile: '', posts: [] };
  const posts = Array.isArray(feed.posts) ? feed.posts.filter((p) => p && p.link && p.image) : [];
  const handle = feed.account ? `@${feed.account}` : '';

  const profileLink = document.getElementById('insta-profile');
  if (profileLink && feed.profile) profileLink.href = feed.profile;

  // 재생 창: 게시물 카드를 누르면 인스타그램으로 넘어가지 않고, 인스타그램이 주는 재생 화면(게시물 주소/embed)을 이 페이지 안에 띄운다.
  // 재생 화면은 카드를 누를 때 처음 불러오고 창을 닫으면 없앤다(소리가 멎고, 누르기 전에는 인스타그램에 연결되지 않는다).
  // 재생 창은 마우스를 쓰는 PC에서만 쓴다. 휴대폰·태블릿에서는 카드를 누르면 전처럼 인스타그램으로 가서 앱이 바로 열린다
  // (휴대폰에서 재생 창을 쓰면 그 안에서 누른 것이 앱이 아니라 인스타그램 웹페이지로 넘어가 버린다 — 2026-11-22 희성님 휴대폰에서 확인).
  const player = document.getElementById('player');
  const playerBody = document.getElementById('player-body');
  const mouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const canPlayHere = Boolean(mouseDevice && player && playerBody && typeof player.showModal === 'function');
  let playerFrame = null;

  const openPlayer = (post) => {
    playerBody.textContent = '';
    const frame = el('iframe');
    frame.src = `${post.link.replace(/\/+$/, '')}/embed`;
    frame.title = `인스타그램 릴스 ${post.caption || ''}`.trim();
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('scrolling', 'no');
    playerBody.append(frame);
    playerFrame = frame;
    player.showModal();
    // 재생 화면의 높이: 머리 54 + 영상 칸(폭의 1.25배) + 아래 줄 154. 불러온 뒤에는 인스타그램이 알려 주는 높이로 맞춘다
    frame.style.height = `${Math.round(208 + frame.clientWidth * 1.25)}px`;
  };

  if (canPlayHere) {
    window.addEventListener('message', (event) => {
      if (!playerFrame || event.source !== playerFrame.contentWindow || event.origin !== 'https://www.instagram.com') return;
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const height = data && data.type === 'MEASURE' && data.details ? Number(data.details.height) : 0;
      if (height > 200 && height < 3000) playerFrame.style.height = `${Math.ceil(height)}px`;
    });
    player.addEventListener('close', () => {
      playerBody.textContent = '';
      playerFrame = null;
    });
    player.querySelector('[data-close-player]')?.addEventListener('click', () => player.close());
    // 창 바깥(어두운 부분)을 누르면 닫는다
    player.addEventListener('click', (event) => {
      if (event.target === player) player.close();
    });
  }

  const playOnClick = (card, post) => {
    if (!canPlayHere) return;
    card.addEventListener('click', (event) => {
      // 새 탭으로 열려는 누름(Ctrl·Shift·⌘를 같이 누름)은 그대로 인스타그램으로 보낸다
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPlayer(post);
    });
  };

  // 손가락으로 누르면 커서를 올렸을 때처럼 떠오르게 한다. 터치 화면에서는 :hover 가 브라우저마다 다르게 붙어서
  // (희성님 휴대폰에서는 가운데 카드만 떠올랐다) 누르는 동안과 뗀 직후에 표시를 직접 붙인다.
  const liftOnTouch = (card) => {
    let timer = 0;
    card.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      window.clearTimeout(timer);
      card.classList.add('is-pressed');
    });
    const release = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => card.classList.remove('is-pressed'), 260);
    };
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) card.addEventListener(type, release);
  };

  // 첫 화면의 세로 영상 세 장: 왼쪽·가운데·오른쪽 순서로 놓고 가운데에 가장 최근 게시물을 둔다
  const heroReels = document.getElementById('hero-reels');
  if (heroReels) {
    const order = [posts[1], posts[0], posts[2]].filter(Boolean);
    for (const post of order) {
      const card = el('a', 'phone');
      card.href = post.link;
      card.target = '_blank';
      card.rel = 'noopener';
      card.setAttribute('aria-label', `영상 보기: ${post.caption || ''}`.trim());
      playOnClick(card, post);
      liftOnTouch(card);

      const blur = el('img', 'phone-blur');
      blur.src = post.image;
      blur.alt = '';
      const shot = el('img', 'phone-shot');
      shot.src = post.image;
      shot.alt = '';

      const top = el('span', 'phone-top');
      top.innerHTML = ICON.reel;
      top.append(el('span', '', '릴스'));

      const bottom = el('span', 'phone-bottom');
      bottom.append(el('b', '', handle), el('span', '', post.caption || ''));

      card.append(blur, shot, top, bottom);
      heroReels.append(card);
    }
    if (!order.length) heroReels.hidden = true;
  }

  // 점검 화면: 주소 뒤에 ?check 를 붙였을 때만 뜬다.
  // 실제 휴대폰에서 카드가 떠오르는지 여기서는 볼 수 없어서, 휴대폰이 받은 파일의 판과 카드를 누를 때 일어나는 일을 화면 아래에 적어 준다.
  // 점검 중에는 카드를 눌러도 인스타그램으로 넘어가지 않는다. 원인을 찾으면 이 토막과 styles.css 의 .check-panel 을 지운다.
  if (params.has('check') && heroReels && !heroReels.hidden) {
    const cards = [...heroReels.querySelectorAll('.phone')];
    const names = ['왼쪽', '가운데', '오른쪽'];
    const panel = el('div', 'check-panel');
    const head = el('p');
    const log = el('ol');
    panel.append(head, log);
    document.body.append(panel);

    const version = (url) => (url && url.split('?v=')[1]) || '없음';
    const offset = (card) => card.getBoundingClientRect().top - heroReels.getBoundingClientRect().top;
    const base = cards.map(offset);
    const ua = navigator.userAgent;
    const browser = (ua.match(/SamsungBrowser\/\d+|KAKAOTALK|NAVER|Whale\/\d+|CriOS\/\d+|FxiOS\/\d+|EdgA?\/\d+|Chrome\/\d+|Version\/\d+/g) || ['모름']).join(' ');
    head.textContent = [
      '점검',
      `동작 ${version(document.querySelector('script[src*="main.js"]')?.src)}`,
      `모양 ${version(document.querySelector('link[rel="stylesheet"][href*="styles.css"]')?.href)}`,
      `폭 ${window.innerWidth}`,
      `터치 ${navigator.maxTouchPoints}`,
      `마우스 기기 ${mouseDevice ? '예' : '아니오'}`,
      browser,
    ].join(' · ');

    const write = (text) => {
      log.prepend(el('li', '', text));
      while (log.children.length > 10) log.lastChild.remove();
    };
    // 한 줄에: 어느 카드, 언제, 누름 표시(is-pressed)가 붙었는지, :hover 인지, 실제로 올라온 높이
    const report = (i, when) => {
      const card = cards[i];
      write(`${names[i]} ${when} 표시${card.classList.contains('is-pressed') ? 'O' : 'X'} hover${card.matches(':hover') ? 'O' : 'X'} ${(base[i] - offset(card)).toFixed(1)}px`);
    };
    cards.forEach((card, i) => {
      card.addEventListener('pointerdown', (event) => {
        window.setTimeout(() => report(i, `누르는 중(${event.pointerType})`), 250);
      });
      card.addEventListener('pointercancel', () => write(`${names[i]} 누름이 취소됨`));
      card.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.setTimeout(() => report(i, '뗀 뒤'), 600);
        },
        true,
      );
    });
    write('카드 세 장을 한 번씩 꾹 눌렀다 떼어 보세요');
  }

  // 가 방식: 게시물 목록으로 직접 그리는 띠
  const carousel = document.getElementById('reel-carousel');
  const track = document.getElementById('reel-track');
  const prev = document.getElementById('reel-prev');
  const next = document.getElementById('reel-next');
  const bar = document.getElementById('reel-bar');

  if (track) {
    for (const post of posts) {
      const card = el('a', 'reel-card');
      card.href = post.link;
      card.target = '_blank';
      card.rel = 'noopener';

      const thumb = el('span', 'reel-thumb');
      const img = el('img');
      img.src = post.image;
      img.alt = '';
      img.loading = 'lazy';
      const badge = el('span', 'reel-badge');
      badge.innerHTML = ICON.reel;
      thumb.append(img, badge);

      const more = el('span', 'reel-more', '릴스 보기');
      more.insertAdjacentHTML('beforeend', canPlayHere ? ICON.play : ICON.out);

      card.append(thumb, el('span', 'reel-caption', post.caption || ''), more);
      playOnClick(card, post);
      track.append(card);
    }

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
      if (bar && track.scrollWidth > 0) {
        bar.style.width = `${Math.min(100, (track.clientWidth / track.scrollWidth) * 100)}%`;
        bar.style.transform = `translateX(${(track.scrollLeft / Math.max(1, track.clientWidth)) * 100}%)`;
      }
    };
    const step = (direction) => {
      const card = track.querySelector('.reel-card');
      const width = card ? card.getBoundingClientRect().width + 14 : 280;
      const count = Math.max(1, Math.floor(track.clientWidth / width) - 1);
      track.scrollBy({ left: direction * width * count, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    prev?.addEventListener('click', () => step(-1));
    next?.addEventListener('click', () => step(1));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    if (!posts.length && carousel) carousel.hidden = true;
  }

  // 나 방식: 위젯 서비스가 그려 주는 띠. ?insta=widget 일 때만 바깥 스크립트를 불러온다
  const widgetSlot = document.getElementById('widget-slot');
  let widgetLoaded = false;
  const setInsta = (mode) => {
    const useWidget = mode === 'widget';
    if (carousel) carousel.hidden = useWidget || !posts.length;
    if (!widgetSlot) return;
    widgetSlot.hidden = !useWidget;
    if (!useWidget || widgetLoaded) return;
    widgetLoaded = true;
    if (window.HR_WIDGET_IMAGE) {
      // 시안 링크에서는 바깥 스크립트를 부를 수 없어 위젯을 찍어 둔 사진으로 보여 준다
      const picture = el('picture');
      const narrow = el('source');
      narrow.media = '(max-width: 719px)';
      narrow.srcset = window.HR_WIDGET_IMAGE.narrow;
      const shot = el('img', 'widget-shot');
      shot.src = window.HR_WIDGET_IMAGE.wide;
      shot.alt = '위젯 서비스가 그려 주는 인스타그램 띠의 모양';
      picture.append(narrow, shot);
      widgetSlot.append(picture, el('p', 'widget-note', '지금 사이트에 붙어 있는 위젯을 찍은 사진입니다. 실제로는 옆으로 저절로 넘어가고, 모양과 색은 위젯 서비스가 정한 범위 안에서만 바꿀 수 있습니다.'));
      return;
    }
    widgetSlot.append(el('div', WIDGET.className));
    const script = el('script');
    script.src = WIDGET.script;
    script.defer = true;
    document.body.append(script);
  };
  setInsta(params.get('insta'));

  // ---------- 3. 시안에서만: 색과 인스타 방식을 바꿔 보는 막대 ----------
  const pickBar = document.getElementById('pick-bar');
  if (pickBar) {
    const press = (group, value) => {
      for (const button of pickBar.querySelectorAll(`[data-${group}]`)) {
        button.setAttribute('aria-pressed', String(button.dataset[group] === value));
      }
    };
    pickBar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.palette) {
        setPalette(button.dataset.palette);
        press('palette', button.dataset.palette);
      }
      if (button.dataset.insta) {
        setInsta(button.dataset.insta);
        press('insta', button.dataset.insta);
        document.getElementById('work')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
    press('palette', root.dataset.palette === 'day' ? 'day' : 'night');
    press('insta', params.get('insta') === 'widget' ? 'widget' : 'own');
  }

  // ---------- 4. 첫 화면의 녹화 시간 (꾸밈) ----------
  const timecode = document.getElementById('timecode');
  if (timecode && !reduceMotion) {
    const started = Date.now();
    const two = (n) => String(n).padStart(2, '0');
    window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      timecode.textContent = `${two(Math.floor(s / 3600) % 100)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
    }, 1000);
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- 5. 개인정보처리방침 창 ----------
  const policy = document.getElementById('privacy');
  if (policy) {
    for (const opener of document.querySelectorAll('[data-open-privacy]')) {
      opener.addEventListener('click', () => {
        if (typeof policy.showModal === 'function') policy.showModal();
        else policy.setAttribute('open', '');
      });
    }
    const close = () => {
      if (typeof policy.close === 'function') policy.close();
      else policy.removeAttribute('open');
    };
    policy.querySelector('[data-close-privacy]')?.addEventListener('click', close);
    // 창 바깥(어두운 부분)을 누르면 닫는다
    policy.addEventListener('click', (event) => {
      if (event.target === policy) close();
    });
  }

  // ---------- 6. 상담 신청 폼 ----------
  const form = document.getElementById('contact-form');
  const thanks = document.getElementById('thanks');
  const thanksPreview = document.getElementById('thanks-preview');
  const errorBox = document.getElementById('form-error');
  const submitButton = document.getElementById('form-submit');
  if (!form || !thanks || !errorBox || !submitButton) return;

  const MESSAGES = {
    'hr-name': '성함 또는 업체명을 적어 주세요.',
    'hr-phone': '연락처를 숫자로 적어 주세요. 예: 010-1234-5678',
    'hr-email': '이메일 주소를 확인해 주세요. 예: name@example.com',
    'hr-message': '문의 내용을 적어 주세요.',
    'hr-consent': '개인정보 수집과 이용에 동의해 주셔야 신청할 수 있습니다.',
  };

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  const check = () => {
    let firstBad = null;
    for (const marked of form.querySelectorAll('.is-invalid')) marked.classList.remove('is-invalid');
    for (const control of form.querySelectorAll('input, textarea')) {
      if (control.name === 'website' || control.checkValidity()) continue;
      control.closest('.field, .check')?.classList.add('is-invalid');
      firstBad ??= control;
    }
    if (!firstBad) return true;
    showError(MESSAGES[firstBad.id] ?? '입력한 내용을 확인해 주세요.');
    firstBad.focus();
    return false;
  };

  const thanksTitle = document.getElementById('thanks-title');
  const thanksText = document.getElementById('thanks-text');
  const showThanks = (viaMailApp) => {
    form.hidden = true;
    thanks.hidden = false;
    if (thanksTitle) thanksTitle.textContent = viaMailApp ? '메일 앱에서 보내기를 눌러 주세요' : '신청이 접수되었습니다';
    if (thanksText) {
      thanksText.textContent = viaMailApp
        ? '적어 주신 내용을 담아 메일 앱을 열었습니다. 보내기를 누르면 신청이 끝납니다.'
        : '남겨 주신 연락처로 연락드리겠습니다. 감사합니다.';
    }
    if (thanksPreview) thanksPreview.hidden = !viaMailApp;
    thanks.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    if (!check()) return;

    const data = new URLSearchParams(new FormData(form));
    // 눈에 안 보이는 칸이 채워져 있으면 자동 스팸으로 보고 보내지 않는다
    if (data.get('website')) {
      showThanks(false);
      return;
    }
    data.delete('website');

    if (!FORM_ENDPOINT) {
      // 받을 주소를 연결하기 전: 적은 내용을 담아 방문자의 메일 앱을 연다
      const lines = [
        `성함 또는 업체명: ${data.get('name') || ''}`,
        `연락처: ${data.get('phone') || ''}`,
        `이메일: ${data.get('email') || ''}`,
        `업종: ${data.get('business') || ''}`,
        `지역: ${data.get('region') || ''}`,
        '',
        data.get('message') || '',
      ];
      const subject = `[하트레코드 상담 신청] ${data.get('name') || ''}`;
      window.location.href = `mailto:contact@heart-record.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      showThanks(true);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = '보내는 중';
    try {
      const response = await fetch(FORM_ENDPOINT, { method: 'POST', body: data });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json().catch(() => ({ ok: true }));
      if (result && result.ok === false) throw new Error('rejected');
      form.reset();
      showThanks(false);
    } catch {
      showError('신청을 보내지 못했습니다. 잠시 뒤 다시 시도하시거나 0506-896-3659로 연락해 주세요.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '상담 신청 보내기';
    }
  });

  document.getElementById('thanks-back')?.addEventListener('click', () => {
    thanks.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
})();
