// ─────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID  = "rzp_live_T5kMrg46QGUDGL"; // ⚠️ TODO: replace with your live key rzp_live_T5kMrg46QGskjGL
const PLAN_ID_MONTHLY  = "plan_T5kPe58itzg4UE"; // FocusGuard Pro Monthly (LIVE) — ₹207/mo
const PLAN_ID_YEARLY   = "plan_T5kR4PXjqBeauq"; // FocusGuard Pro Yearly (LIVE) — ₹1659/yr
const LIFETIME_AMOUNT_INR_PAISE = 207400; // ₹2074
const EXTENSION_ID = "beibpcgfacpcejcdcjacjoohnhnpeaoj";
// ─────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const planType = params.get("plan") || "monthly";
let userEmail = "";
let paymentAlreadySucceeded = false;

const titles = {
  monthly:  "FocusGuard Pro — Monthly",
  yearly:   "FocusGuard Pro — Yearly",
  lifetime: "FocusGuard Pro — Lifetime"
};

let razorpayReady = false;
const continueBtn = document.getElementById("continueBtn");
continueBtn.disabled = true;

function checkRazorpayLoaded() {
  if (typeof window.Razorpay !== "undefined") {
    razorpayReady = true;
    continueBtn.disabled = false;
    continueBtn.textContent = "Continue to payment →";
  } else {
    setTimeout(checkRazorpayLoaded, 100);
  }
}
checkRazorpayLoaded();

setTimeout(() => {
  if (!razorpayReady) {
    continueBtn.textContent = "Payment system unavailable";
    const errEl = document.getElementById("emailError");
    errEl.textContent = "Couldn't load the payment gateway. Reload this page.";
    errEl.style.display = "block";
  }
}, 8000);

continueBtn.addEventListener("click", () => {
  if (!razorpayReady) return;
  const input = document.getElementById("emailInput");
  const email = input.value.trim();
  const errEl = document.getElementById("emailError");

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValid) {
    errEl.textContent = "Please enter a valid email address.";
    errEl.style.display = "block";
    input.style.borderColor = "#ff5555";
    return;
  }

  userEmail = email;
  document.getElementById("emailStep").style.display = "none";
  document.getElementById("checkoutStep").style.display = "block";
  setTimeout(openCheckout, 200);
});

function showError(msg) {
  if (paymentAlreadySucceeded) return; // never show errors after a real success
  document.getElementById("spinner").style.display = "none";
  document.getElementById("statusTitle").textContent = "Couldn't open checkout";
  document.getElementById("statusText").style.display = "none";
  document.getElementById("errorMsg").textContent = msg;
  document.getElementById("errorMsg").style.display = "block";
  document.getElementById("retryBtn").style.display = "inline-block";
}

function openCheckout() {
  let options;

  if (planType === "lifetime") {
    options = {
      key: RAZORPAY_KEY_ID,
      amount: LIFETIME_AMOUNT_INR_PAISE,
      currency: "INR",
      name: "FocusGuard",
      description: titles.lifetime,
      prefill: { email: userEmail },
      notes: { product: "FocusGuard", plan: "lifetime", email: userEmail },
      theme: { color: "#c8f135" },
      handler: onPaymentSuccess,
      modal: { ondismiss: onDismiss }
    };
  } else {
    const planId = planType === "yearly" ? PLAN_ID_YEARLY : PLAN_ID_MONTHLY;
    options = {
      key: RAZORPAY_KEY_ID,
      plan_id: planId,
      name: "FocusGuard",
      description: titles[planType] || titles.monthly,
      prefill: { email: userEmail },
      notes: { product: "FocusGuard", plan: planType, email: userEmail },
      theme: { color: "#c8f135" },
      handler: onPaymentSuccess,
      modal: { ondismiss: onDismiss }
    };
  }

  const rzp = new Razorpay(options);
  rzp.on("payment.failed", function(response) {
    if (paymentAlreadySucceeded) return; // ignore late/duplicate failure events
    showError("Payment failed: " + (response.error?.description || "Unknown error"));
  });
  rzp.open();
}

function onPaymentSuccess(response) {
  paymentAlreadySucceeded = true;
  const subId = response.razorpay_subscription_id || response.razorpay_payment_id || "N/A";

  document.getElementById("statusTitle").textContent = "Payment successful! 🎉";
  document.getElementById("statusText").innerHTML =
    `Your reference ID is:<br><strong style="color:#c8f135; font-family:monospace;">${subId}</strong>` +
    `<br><br>Save this — include it in any email to us if you ever need to cancel or get support.` +
    `<br><br>You can close this tab now.`;
  document.getElementById("spinner").style.display = "none";
  document.getElementById("errorMsg").style.display = "none";
  document.getElementById("retryBtn").style.display = "none";

  // Send result back to the extension (this page is NOT an extension page,
  // so we use chrome.runtime.sendMessage with the extension's ID — only
  // works because the extension's manifest lists this domain under
  // externally_connectable)
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(EXTENSION_ID, {
        type: "FOCUSGUARD_PAYMENT_SUCCESS",
        plan: planType,
        email: userEmail,
        paymentId: response.razorpay_payment_id || "",
        subscriptionId: response.razorpay_subscription_id || ""
      }, (reply) => {
        if (chrome.runtime.lastError) {
          console.log("Extension message error (Pro may not auto-unlock):", chrome.runtime.lastError.message);
        }
      });
    }
  } catch (e) {
    console.log("Could not message extension:", e);
  }
}

function onDismiss() {
  document.getElementById("statusTitle").textContent = "Checkout closed";
  document.getElementById("statusText").textContent = "You can close this tab.";
  document.getElementById("spinner").style.display = "none";
}

document.getElementById("retryBtn").addEventListener("click", () => location.reload());
