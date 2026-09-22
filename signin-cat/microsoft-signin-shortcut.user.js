// ==UserScript==
// @name         Microsoft sign-in shortcut
// @namespace    https://github.com/jepetty
// @version      1.3.1
// @description  Correct the Microsoft account email and select Windows Hello/passkey sign-in.
// @match        https://login.microsoftonline.com/*
// @match        https://login.live.com/*
// @match        https://login.windows.net/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const WRONG_EMAIL = 'jessica.petty@microsoft.com';
    const RIGHT_EMAIL = 'jepetty@microsoft.com';
    const PASSKEY_TEXT = /passkey|face\s*,?\s*fingerprint\s*,?\s*pin\s+or\s+security\s+key/i;
    const OTHER_METHOD_TEXT = /sign in another way/i;
    const lastClick = new Map();
    let lastDiagnostic = 0;

    function log(message, details) {
        if (details === undefined) {
            console.info(`[MS Sign-in] ${message}`);
        } else {
            console.info(`[MS Sign-in] ${message}`, details);
        }
    }

    function isVisible(element) {
        if (!(element instanceof HTMLElement)) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden'
            && style.display !== 'none'
            && style.opacity !== '0'
            && rect.width > 0
            && rect.height > 0
            && rect.right > 0
            && rect.bottom > 0
            && rect.left < window.innerWidth
            && rect.top < window.innerHeight
            && !element.closest('[aria-hidden="true"]');
    }

    function setInputValue(input, value) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        descriptor.set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function clickWithRetry(key, element) {
        if (!element || !isVisible(element)) return false;

        const now = Date.now();
        if (now - (lastClick.get(key) ?? 0) < 750) return true;
        lastClick.set(key, now);

        log(`Clicking ${key}`, {
            tag: element.tagName,
            id: element.id || '(none)',
            text: (element.innerText || element.getAttribute('value') || '').trim(),
        });
        element.click();
        return true;
    }

    function findClickableByText(pattern) {
        const candidates = document.querySelectorAll('button, a, [role="button"], [tabindex], .table');
        return [...candidates].find((element) => isVisible(element) && pattern.test(element.innerText?.trim() ?? ''));
    }

    function firstVisible(selector) {
        return [...document.querySelectorAll(selector)].find(isVisible);
    }

    function logPasswordPageDiagnostics() {
        const now = Date.now();
        if (now - lastDiagnostic < 2000) return;
        lastDiagnostic = now;

        const controls = [...document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]')]
            .filter(isVisible)
            .map((element) => ({
                tag: element.tagName,
                id: element.id || '(none)',
                text: (element.innerText || element.getAttribute('value') || '').trim(),
            }));

        log('Password page detected, but "Sign in another way" was not found', controls);
    }

    function automate() {
        const password = firstVisible('input#i0118, input[name="passwd"], input[type="password"]');
        if (password) {
            const otherMethod = firstVisible('#idA_PWD_SwitchToCredPicker')
                ?? findClickableByText(OTHER_METHOD_TEXT);
            if (clickWithRetry('other-method', otherMethod)) return;

            logPasswordPageDiagnostics();
            return;
        }

        const passkey = firstVisible('[data-value="Fido"], [data-testid*="fido" i], [data-testid*="passkey" i]')
            ?? findClickableByText(PASSKEY_TEXT);
        if (clickWithRetry('passkey', passkey)) return;

        const email = document.querySelector('input#i0116, input[name="loginfmt"], input[type="email"]');
        if (email instanceof HTMLInputElement && isVisible(email)) {
            const current = email.value.trim().toLowerCase();
            if (current === '' || current === WRONG_EMAIL) {
                log('Replacing the email address');
                setInputValue(email, RIGHT_EMAIL);
            }

            if (email.value.trim().toLowerCase() === RIGHT_EMAIL) {
                const next = firstVisible('#idSIButton9, input[type="submit"], button[type="submit"]');
                clickWithRetry('next', next);
                return;
            }
        }
    }

    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
            scheduled = false;
            automate();
        }, 100);
    }

    new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
    window.addEventListener('pageshow', schedule);
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
    setInterval(automate, 500);
    schedule();
})();
