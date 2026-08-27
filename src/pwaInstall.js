let deferredInstallPrompt = null;
const listeners = new Set();

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches
  || window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

const notify = () => {
  const state = getInstallState();
  listeners.forEach((listener) => listener(state));
};

export const getInstallState = () => ({
  canPrompt: Boolean(deferredInstallPrompt),
  installed: isStandalone(),
  ios: isIos(),
});

export const subscribeToInstallState = (listener) => {
  listeners.add(listener);
  listener(getInstallState());
  return () => listeners.delete(listener);
};

export const requestAppInstall = async () => {
  if (isStandalone()) return { status: "installed" };

  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    notify();
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return { status: choice.outcome === "accepted" ? "accepted" : "dismissed" };
  }

  return { status: isIos() ? "ios-help" : "unavailable" };
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notify();
  });
}
