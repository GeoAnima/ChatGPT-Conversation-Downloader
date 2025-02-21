// ==UserScript==
// @name         ChatGPT Conversation Downloader
// @namespace    none
// @version      1.0
// @author       Geo_Anima
// @description  Download ChatGPT conversations in JSON format, inserted left of "Share" button
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // Global state and fetch patching
    let chatDataFromFetch = null;
    let buttonInserted = false;

    const originalFetch = window.fetch;
    window.fetch = async function monkeyPatchedFetch(...args) {
        const resp = await originalFetch.apply(this, args);
        try {
            const cloned = resp.clone();
            const data = await cloned.json();
            if (isLikelyConversationData(data)) {
                chatDataFromFetch = data;
            }
        } catch (err) {
            // Ignore non-JSON/non-conversation responses
        }
        return resp;
    };

    function isLikelyConversationData(obj) {
        return obj?.messages?.constructor === Array;
    }

    // DOM observation and button management
    const observer = new MutationObserver(mutations => {
        const shareBtn = document.querySelector('button[data-testid="share-chat-button"]');
        if (shareBtn && !buttonInserted) {
            insertDownloadButtonLeftOfShare(shareBtn);
            buttonInserted = true;
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('unload', () => observer.disconnect());

    function insertDownloadButtonLeftOfShare(shareBtn) {
        const container = shareBtn.parentNode;
        if (!container) return;

        const newBtn = document.createElement('button');
        newBtn.id = 'download-chatgpt-json-btn';
        newBtn.textContent = 'Download JSON';
        newBtn.className = 'btn relative btn-secondary text-token-text-primary';
        newBtn.addEventListener('click', onDownloadClick);
        shareBtn.insertAdjacentElement('beforebegin', newBtn);
    }

    // Data handling and download logic
    function onDownloadClick() {
        if (chatDataFromFetch) {
            saveDataAsJson(chatDataFromFetch, 'chatgpt_conversation');
            return;
        }

        const messages = getDomMessages();
        if (!messages?.length) {
            alert('No conversation data found from fetch or DOM');
            return;
        }

        saveDataAsJson({ messages }, 'chatgpt_conversation');
    }

    function getDomMessages() {
        return Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'))
            .map(turn => {
                const roleEl = turn.querySelector('[data-message-author-role]');
                const textEl = turn.querySelector('.text-message, .markdown.prose');
                return roleEl && textEl ? {
                    role: roleEl.getAttribute('data-message-author-role') || 'unknown',
                    content: textEl.innerText.trim()
                } : null;
            })
            .filter(Boolean);
    }

    function saveDataAsJson(obj, baseName) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
})();