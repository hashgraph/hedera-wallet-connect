"use strict";
(() => {
  // demos/typescript/main.ts
  var iframe = document.querySelectorAll("iframe");
  var dapp = iframe[0];
  var wallet = iframe[1];
  dapp.src = "/demos/typescript/dapp/index.html";
  wallet.src = "/demos/typescript/wallet/index.html";
})();
