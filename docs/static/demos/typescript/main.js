"use strict";
(() => {
  // demos/typescript/main.ts
  var MAX_RETRIES = 3;
  var INITIAL_DELAY = 2e4;
  async function setIframeSrcWithRetry() {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const iframe = document.querySelectorAll("iframe");
        const dapp = iframe[0];
        const wallet = iframe[1];
        await new Promise((resolve) => setTimeout(resolve, INITIAL_DELAY * Math.pow(2, attempt)));
        dapp.src = "/demos/typescript/dapp/index.html";
        wallet.src = "/demos/typescript/wallet/index.html";
        console.log("demo iframes are loaded");
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) {
          console.error("Failed to set iframe sources after maximum retries:", error);
        }
        console.warn(`Attempt ${attempt + 1} failed, retrying...`);
      }
    }
  }
  setIframeSrcWithRetry();
})();
