import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GameSystem } from './game-system.js';
import { HandSignSystem } from './hands-system.js';
import { sound } from './sound.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(HandSignSystem);
  world.registerSystem(GameSystem);

  // The page's own Enter VR button: the only step that happens outside VR.
  const overlay = document.getElementById('intro');
  const enter = document.getElementById('enter-vr') as HTMLButtonElement | null;
  const note = document.getElementById('intro-note');
  const noVR = () => {
    if (enter) enter.disabled = true;
    if (note) note.textContent = 'This browser cannot start VR. Open this page in the browser on a Meta Quest headset.';
  };
  if (!world.xrEnabled || !navigator.xr) noVR();
  else void navigator.xr.isSessionSupported('immersive-vr').then((ok) => !ok && noVR(), noVR);
  enter?.addEventListener('click', () => {
    sound.unlock();
    void world.launchXR();
  });
  world.visibilityState.subscribe((state) => {
    if (overlay) overlay.style.display = state === VisibilityState.NonImmersive ? 'flex' : 'none';
  });
});
