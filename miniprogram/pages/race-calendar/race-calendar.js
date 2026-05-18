// pages/race-calendar/race-calendar.js
const { get } = require('../../utils/request');
const { t, getLocale } = require('../../utils/i18n');
const { formatDate } = require('../../utils/util');

Page({
  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    currentYear: 2026,
    currentMonth: 5,
    calendarDays: [],
    selectedDate: '',
    selectedRaces: [],
    upcomingRaces: []
  },

  onLoad() {
    this.initI18n();
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    this.loadRaces();
  },

  /**
   * 初始化i18n
   */
  initI18n() {
    const locale = getLocale();
    this.t = (key) => t(key, locale);
    // 根据语言设置星期显示
    if (locale === 'zh-TW') {
      this.setData({
        weekDays: ['日', '一', '二', '三', '四', '五', '六']
      });
    }
    this.setData({
      t: this.t,
      monthYear: this.formatMonthYear()
    });
  },

  /**
   * 格式化月份年份显示
   */
  formatMonthYear() {
    return this.t('monthYear').replace('{year}', this.data.currentYear).replace('{month}', this.data.currentMonth);
  },

  // 加载赛事数据
  async loadRaces() {
    try {
      const res = await get('/races', { limit: 100 });
      if (res && res.code === 200) {
        this.allRaces = res.data || [];
        this.generateCalendar();
        this.loadUpcomingRaces();
      }
    } catch (err) {
      console.error('加载赛事失败:', err);
    }
  },

  // 生成日历数据
  generateCalendar() {
    const { currentYear, currentMonth } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const calendarDays = [];

    // 上月填充
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        date: '',
        races: []
      });
    }

    // 当前月
    const today = formatDate(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRaces = (this.allRaces || []).filter(r => r.start_date === date || r.end_date === date);
      
      calendarDays.push({
        day: d,
        isCurrentMonth: true,
        isToday: date === today,
        date: date,
        races: dayRaces
      });
    }

    // 下月填充
    const totalCells = Math.ceil(calendarDays.length / 7) * 7;
    for (let i = 1; calendarDays.length < totalCells; i++) {
      calendarDays.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        date: '',
        races: []
      });
    }

    this.setData({ calendarDays, monthYear: this.formatMonthYear() });
  },

  // 加载即将开始的赛事
  loadUpcomingRaces() {
    const now = new Date();
    const today = formatDate(now);
    
    const upcoming = (this.allRaces || [])
      .filter(r => r.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5)
      .map(r => {
        const raceDate = new Date(r.start_date);
        const diffMs = raceDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let countdownText = '';
        if (diffDays === 0) {
          countdownText = this.t('countdownToday');
        } else if (diffDays === 1) {
          countdownText = this.t('countdownTomorrow');
        } else {
          countdownText = this.t('countdownDays').replace('{days}', diffDays);
        }
        return { ...r, countdownText };
      });

    this.setData({ upcomingRaces: upcoming });
  },

  // 切换月份
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  // 回到今天
  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    this.generateCalendar();
  },

  // 点击日期
  tapDay(e) {
    const { day } = e.currentTarget.dataset;
    if (!day || !day.isCurrentMonth) return;
    
    this.setData({
      selectedDate: day.date,
      selectedRaces: day.races
    });
  },

  // 跳转到赛事详情
  goToRace(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/race-detail/race-detail?id=${id}`
    });
  },

  // 添加到日历（模拟功能）
  addToCalendar(e) {
    const { race } = e.currentTarget.dataset;
    if (!race) return;

    wx.showModal({
      title: this.t('addToCalendarTitle'),
      content: this.t('addToCalendarContent').replace('{raceName}', race.race_name),
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: this.t('addedToCalendar'),
            icon: 'success'
          });
          // 实际实现需要调用系统日历API
          console.log('添加赛事到日历:', race);
        }
      }
    });
  }
});
