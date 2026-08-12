// 键盘快捷键帮助面板
(function() {
    const helpBtn = document.getElementById('helpShortcutsBtn');
    const helpPanel = document.getElementById('shortcutsHelp');
    const closeBtn = document.getElementById('shortcutsCloseBtn');
    
    function showHelp() {
        helpPanel.style.display = 'flex';
        helpPanel.setAttribute('aria-hidden', 'false');
        if (closeBtn) closeBtn.focus();
    }
    
    function hideHelp() {
        helpPanel.style.display = 'none';
        helpPanel.setAttribute('aria-hidden', 'true');
        if (helpBtn) helpBtn.focus();
    }
    
    if (helpBtn) {
        helpBtn.addEventListener('click', showHelp);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', hideHelp);
    }
    
    if (helpPanel) {
        helpPanel.addEventListener('click', function(e) {
            if (e.target === helpPanel) hideHelp();
        });
    }
    
    // 添加 Alt+H 快捷键
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key.toLowerCase() === 'h') {
            if (helpPanel.style.display === 'flex') {
                hideHelp();
            } else {
                showHelp();
            }
            e.preventDefault();
        }
        
        // ESC 关闭帮助面板
        if (e.key === 'Escape' && helpPanel.style.display === 'flex') {
            hideHelp();
            e.preventDefault();
        }
    });
})();
