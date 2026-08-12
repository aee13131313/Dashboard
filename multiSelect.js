/**
 * MultiSelectWidget — 可复用的自定义多选下拉框组件
 * 统一了智书看板中「商家趋势图选择器」和「商家指标卡片选择器」的重复逻辑
 */
class MultiSelectWidget {
    /**
     * @param {Object} config
     * @param {string} config.containerId  - 外层容器 id
     * @param {string} config.buttonId     - 触发按钮 id
     * @param {string} config.dropdownId   - 下拉面板 id
     * @param {string} config.textId       - 按钮内文本 span id
     * @param {string} config.checkboxPrefix - 复选框 id 前缀（如 'merchant-trend-'）
     * @param {Function} config.onChange   - 选中项变化回调，参数: (selectedNames, allNames)
     */
    constructor(config) {
        this.container   = document.getElementById(config.containerId);
        this.button      = document.getElementById(config.buttonId);
        this.dropdown    = document.getElementById(config.dropdownId);
        this.textSpan    = document.getElementById(config.textId);
        this.checkboxPrefix = config.checkboxPrefix;
        this.onChange     = config.onChange;
        this._initialized = false;
    }

    /** 当前所有选项名称 */
    get allNames() {
        return this._allNames || [];
    }

    /** 当前选中项名称数组 */
    get selectedNames() {
        if (!this.dropdown) return [];
        return Array.from(
            this.dropdown.querySelectorAll('input[type="checkbox"]:checked')
        ).map(cb => cb.dataset.merchant);
    }

    /** HTML 转义，避免商家名称中的特殊字符破坏动态模板 */
    _escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    /**
     * 初始化或刷新选项列表
     * @param {string[]} names  - 所有选项名称
     * @param {string[]} [defaultSelected] - 首次初始化时默认选中的名称
     * @param {boolean} [preserveSelection=true] - 刷新时是否优先保留 DOM 中已有选择
     */
    init(names, defaultSelected, preserveSelection = true) {
        if (!this.container || !this.button || !this.dropdown) return;

        this._allNames = names;

        // 保存当前选中项（刷新场景）
        const previouslySelected = this._initialized && preserveSelection
            ? this.selectedNames
            : (defaultSelected || []);

        // 生成复选框 HTML
        this.dropdown.innerHTML = names.map((name, index) => {
            const id = `${this.checkboxPrefix}${index}`;
            const safeName = this._escapeHtml(name);
            return `
                <div class="custom-multiselect-option">
                    <input type="checkbox" id="${id}" data-merchant="${safeName}" data-index="${index}">
                    <label for="${id}">${safeName}</label>
                </div>
            `;
        }).join('');

        // 绑定复选框事件
        this.dropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this._notifyChange();
            });
            checkbox.addEventListener('click', e => e.stopPropagation());
        });

        // 首次初始化：绑定按钮点击 + 外部点击关闭
        if (!this._initialized) {
            this.button.addEventListener('click', e => {
                e.stopPropagation();
                this.dropdown.classList.toggle('active');
            });

            document.addEventListener('click', e => {
                if (!this.container.contains(e.target)) {
                    this.dropdown.classList.remove('active');
                }
            });

            this._initialized = true;
        }

        // 恢复/设置选中状态
        let selected = previouslySelected.filter(n => names.includes(n));
        if (selected.length === 0 && names.length > 0) {
            selected = defaultSelected && defaultSelected.length > 0
                ? defaultSelected.filter(n => names.includes(n))
                : [names[0]];
        }

        selected.forEach(name => {
            const cb = Array.from(this.dropdown.querySelectorAll('input[type="checkbox"]'))
                .find(input => input.dataset.merchant === name);
            if (cb) cb.checked = true;
        });

        this._updateButtonText(selected);
    }

    /** 更新按钮显示文本 */
    _updateButtonText(selected) {
        if (!this.textSpan) return;
        const all = this._allNames || [];
        if (selected.length === 0) {
            this.textSpan.textContent = '选择商家';
        } else if (selected.length === 1) {
            this.textSpan.textContent = selected[0];
        } else if (selected.length === all.length) {
            this.textSpan.textContent = `全部商家 (${selected.length})`;
        } else {
            this.textSpan.textContent = `已选择 ${selected.length} 个商家`;
        }
    }

    /** 通知外部选中项变化 */
    _notifyChange() {
        const selected = this.selectedNames;
        this._updateButtonText(selected);
        if (this.onChange) {
            this.onChange(selected, this._allNames);
        }
    }
}

// 导出全局实例，供 dashboard.js 使用
window.MultiSelectWidget = MultiSelectWidget;
