export type MenuScreen = 'main' | 'host' | 'join' | 'none';

export interface MenuButton {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  action: string;
}

export interface MenuState {
  screen: MenuScreen;
  // Host screen
  roomCode: string;
  lanIPs: string[];
  playerList: { id: string; name: string }[];
  // Join screen
  joinStatus: string;
  // Shared
  animTime: number;
}

export function createMenuState(): MenuState {
  return {
    screen: 'main',
    roomCode: '',
    lanIPs: [],
    playerList: [],
    joinStatus: '',
    animTime: 0,
  };
}

// DOM overlay for text inputs (join screen)
let inputOverlay: HTMLDivElement | null = null;
let ipInput: HTMLInputElement | null = null;
let roomInput: HTMLInputElement | null = null;
let nameInput: HTMLInputElement | null = null;

export function showJoinInputs(): void {
  if (inputOverlay) return;

  inputOverlay = document.createElement('div');
  inputOverlay.id = 'join-overlay';
  inputOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    pointer-events: none; z-index: 10;
  `;

  const form = document.createElement('div');
  form.style.cssText = `
    pointer-events: auto; display: flex; flex-direction: column; gap: 12px;
    width: 280px; padding: 20px;
  `;

  const inputStyle = `
    background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3);
    color: #fff; font-size: 18px; padding: 14px 16px; border-radius: 12px;
    outline: none; text-align: center; font-family: sans-serif;
    width: 100%; box-sizing: border-box;
  `;

  const defaultHost = window.location.hostname || 'localhost';

  ipInput = document.createElement('input');
  ipInput.type = 'text';
  ipInput.placeholder = 'Server IP';
  ipInput.value = defaultHost;
  ipInput.style.cssText = inputStyle;
  ipInput.setAttribute('autocomplete', 'off');
  ipInput.setAttribute('autocorrect', 'off');
  ipInput.setAttribute('autocapitalize', 'off');

  roomInput = document.createElement('input');
  roomInput.type = 'text';
  roomInput.placeholder = 'Room Code';
  roomInput.maxLength = 4;
  roomInput.style.cssText = inputStyle + 'text-transform: uppercase; letter-spacing: 8px; font-size: 24px; font-weight: bold;';
  roomInput.setAttribute('autocomplete', 'off');
  roomInput.setAttribute('autocorrect', 'off');
  roomInput.setAttribute('autocapitalize', 'characters');

  nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Your Name';
  nameInput.maxLength = 12;
  nameInput.value = 'Player';
  nameInput.style.cssText = inputStyle;
  nameInput.setAttribute('autocomplete', 'off');
  nameInput.setAttribute('autocorrect', 'off');

  // Shift inputs above the connect button area for mobile
  form.style.marginTop = '-100px';

  form.appendChild(ipInput);
  form.appendChild(roomInput);
  form.appendChild(nameInput);
  inputOverlay.appendChild(form);
  document.body.appendChild(inputOverlay);
}

export function hideJoinInputs(): void {
  if (inputOverlay) {
    inputOverlay.remove();
    inputOverlay = null;
    ipInput = null;
    roomInput = null;
    nameInput = null;
  }
}

export function getJoinInputValues(): { ip: string; room: string; name: string } {
  return {
    ip: ipInput?.value.trim() || 'localhost',
    room: (roomInput?.value.trim() || '').toUpperCase(),
    name: nameInput?.value.trim() || 'Player',
  };
}

// --- Canvas-based menu rendering ---

export function getMenuButtons(screen: MenuScreen, screenW: number, screenH: number): MenuButton[] {
  const cx = screenW / 2;
  const btnW = Math.min(280, screenW - 40);
  const btnH = 56;

  if (screen === 'main') {
    const startY = screenH * 0.5;
    return [
      { label: 'Play Solo', x: cx - btnW / 2, y: startY, w: btnW, h: btnH, color: '#2ED573', action: 'solo' },
      { label: 'Host Game', x: cx - btnW / 2, y: startY + btnH + 16, w: btnW, h: btnH, color: '#1E90FF', action: 'host' },
      { label: 'Join Game', x: cx - btnW / 2, y: startY + (btnH + 16) * 2, w: btnW, h: btnH, color: '#FFA502', action: 'join' },
    ];
  }

  if (screen === 'host') {
    const startY = screenH * 0.72;
    return [
      { label: 'Start Game', x: cx - btnW / 2, y: startY, w: btnW, h: btnH, color: '#2ED573', action: 'start-host' },
      { label: '← Back', x: cx - btnW / 2, y: startY + btnH + 16, w: btnW, h: 44, color: '#555', action: 'back' },
    ];
  }

  if (screen === 'join') {
    const startY = screenH * 0.72;
    return [
      { label: 'Connect', x: cx - btnW / 2, y: startY, w: btnW, h: btnH, color: '#FFA502', action: 'connect' },
      { label: '← Back', x: cx - btnW / 2, y: startY + btnH + 16, w: btnW, h: 44, color: '#555', action: 'back' },
    ];
  }

  return [];
}

export function hitTestButtons(buttons: MenuButton[], x: number, y: number): string | null {
  for (const btn of buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      return btn.action;
    }
  }
  return null;
}

export function renderMenu(
  ctx: CanvasRenderingContext2D,
  state: MenuState,
  screenW: number,
  screenH: number,
): void {
  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, screenW, screenH);

  // Animated particles
  renderParticles(ctx, state.animTime, screenW, screenH);

  if (state.screen === 'main') {
    renderMainMenu(ctx, state, screenW, screenH);
  } else if (state.screen === 'host') {
    renderHostScreen(ctx, state, screenW, screenH);
  } else if (state.screen === 'join') {
    renderJoinScreen(ctx, state, screenW, screenH);
  }
}

function renderParticles(ctx: CanvasRenderingContext2D, time: number, w: number, h: number): void {
  ctx.save();
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(i * 3.7 + time * 0.3) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 2.3 + time * 0.2) * 0.5 + 0.5) * h;
    const r = 2 + Math.sin(i + time) * 1;
    const alpha = 0.1 + Math.sin(i * 1.5 + time * 0.8) * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
  ctx.restore();
}

function renderMainMenu(ctx: CanvasRenderingContext2D, state: MenuState, screenW: number, screenH: number): void {
  const cx = screenW / 2;

  // Title
  const titleY = screenH * 0.25;
  const bounce = Math.sin(state.animTime * 2) * 6;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title shadow
  ctx.fillStyle = 'rgba(255,71,87,0.3)';
  ctx.font = `bold ${Math.min(72, screenW * 0.15)}px sans-serif`;
  ctx.fillText('SPIKIO', cx + 2, titleY + bounce + 3);

  // Title
  ctx.fillStyle = '#FF4757';
  ctx.fillText('SPIKIO', cx, titleY + bounce);

  // Subtitle
  ctx.font = `${Math.min(16, screenW * 0.04)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('sling • spike • survive', cx, titleY + bounce + 50);

  ctx.restore();

  // Buttons
  const buttons = getMenuButtons('main', screenW, screenH);
  for (const btn of buttons) {
    renderButton(ctx, btn);
  }
}

function renderHostScreen(ctx: CanvasRenderingContext2D, state: MenuState, screenW: number, screenH: number): void {
  const cx = screenW / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `bold ${Math.min(18, screenW * 0.045)}px sans-serif`;
  ctx.fillText('HOSTING GAME', cx, screenH * 0.08);

  // Room code - large and prominent
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `${Math.min(14, screenW * 0.035)}px sans-serif`;
  ctx.fillText('ROOM CODE', cx, screenH * 0.16);

  const codeSize = Math.min(64, screenW * 0.14);
  ctx.fillStyle = '#FFA502';
  ctx.font = `bold ${codeSize}px monospace`;
  const pulse = 1 + Math.sin(state.animTime * 3) * 0.02;
  ctx.save();
  ctx.translate(cx, screenH * 0.24);
  ctx.scale(pulse, pulse);
  ctx.fillText(state.roomCode || '----', 0, 0);
  ctx.restore();

  // LAN IPs
  if (state.lanIPs.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.min(13, screenW * 0.032)}px sans-serif`;
    ctx.fillText('LAN IP', cx, screenH * 0.33);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.min(16, screenW * 0.04)}px monospace`;
    ctx.fillText(state.lanIPs[0] + ':3001', cx, screenH * 0.37);
  }

  // Player list
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `bold ${Math.min(14, screenW * 0.035)}px sans-serif`;
  ctx.fillText('PLAYERS', cx, screenH * 0.46);

  const listY = screenH * 0.51;
  for (let i = 0; i < state.playerList.length; i++) {
    const p = state.playerList[i];
    ctx.fillStyle = i === 0 ? '#1E90FF' : '#2ED573';
    ctx.font = `${Math.min(16, screenW * 0.04)}px sans-serif`;
    ctx.fillText(`${i === 0 ? '👑 ' : ''}${p.name}`, cx, listY + i * 28);
  }

  if (state.playerList.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `${Math.min(14, screenW * 0.035)}px sans-serif`;
    ctx.fillText('Waiting for players...', cx, listY);
  }

  ctx.restore();

  // Buttons
  const buttons = getMenuButtons('host', screenW, screenH);
  for (const btn of buttons) {
    renderButton(ctx, btn);
  }
}

function renderJoinScreen(ctx: CanvasRenderingContext2D, state: MenuState, screenW: number, screenH: number): void {
  const cx = screenW / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `bold ${Math.min(18, screenW * 0.045)}px sans-serif`;
  ctx.fillText('JOIN GAME', cx, screenH * 0.08);

  // Instructions
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `${Math.min(14, screenW * 0.035)}px sans-serif`;
  ctx.fillText('Enter the host details below', cx, screenH * 0.14);

  // Status
  if (state.joinStatus) {
    ctx.fillStyle = state.joinStatus.includes('Error') || state.joinStatus.includes('failed')
      ? '#FF4757' : '#2ED573';
    ctx.font = `bold ${Math.min(14, screenW * 0.035)}px sans-serif`;
    ctx.fillText(state.joinStatus, cx, screenH * 0.65);
  }

  ctx.restore();

  // Buttons
  const buttons = getMenuButtons('join', screenW, screenH);
  for (const btn of buttons) {
    renderButton(ctx, btn);
  }
}

function renderButton(ctx: CanvasRenderingContext2D, btn: MenuButton): void {
  const r = 14;

  // Button background
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(btn.x, btn.y, btn.w, btn.h, r);
  ctx.fillStyle = btn.color;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Highlight at top
  ctx.beginPath();
  ctx.roundRect(btn.x, btn.y, btn.w, btn.h / 2, [r, r, 0, 0]);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fill();

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.min(20, btn.h * 0.38)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.restore();
}
