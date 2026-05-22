/**
 * 赛事日历页面逻辑
 * v1.0 优化版：赛事期间全覆盖标记 + 状态颜色 + 新日历API
 */

const { get } = require('../../utils/request');
const { formatDate } = require('../../utils/util');

Page({
  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    currentYear: 2026,
    currentMonth: 5,
    monthText: '',
    calendarDays: [],
    selectedDate: '',
    selectedRaces: [],
    upcomingRaces: [],
    allRaces: [], // 当前月的所有赛事
    loading: false,
    // 赛事类型颜色映射（key 对齐数据库 category 实际值）
    categoryColors: {
      'Grand Tour':              '#f1c40f', // 大环赛 - 金色
      'WorldTour':               '#e74c3c', // 世巡赛 - 红色
      'ProSeries':               '#f39c12', // 职业系列赛 - 橙色
      'Continental':             '#95a5a6', // 洲际赛 - 灰色
      'World Championships':     '#e67e22', // 世锦赛 - 彩虹橙
      'Women-WorldTour':         '#9b59b6', // 女子世巡赛 - 紫色
      'Women-ProSeries':         '#1abc9c'  // 女子职业系列赛 - 青绿
    }
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    this.loadCalendarData();
  },

  /**
   * 加载赛事日历数据
   */
  async loadCalendarData() {
    this.setData({ loading: true });

    try {
      const res = await get('/races/calendar', {
        year: this.data.currentYear,
        month: this.data.currentMonth
      });

      if (res && res.code === 200 && res.data) {
        const races = res.data.races || [];
        this.setData({
          allRaces: races,
          monthText: `${this.data.currentYear}年${this.data.currentMonth}月`
        });
        this.generateCalendar();
        this.loadUpcomingRaces(races);
      }
    } catch (err) {
      console.error('加载赛事日历失败:', err);
      // 降级：尝试旧API
      this.loadRacesFallback();
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 降级加载（使用旧API）
   */
  async loadRacesFallback() {
    try {
      const res = await get('/races', { limit: 100 });
      if (res && res.code === 200) {
        const today = new Date().toISOString().split('T')[0];
        const races = (res.data || []).map(r => {
          let status = 'upcoming';
          if (r.start_date <= today && r.end_date >= today) status = 'ongoing';
          else if (r.end_date < today) status = 'finished';
          // 计算赛事覆盖日期
          const raceDays = [];
          if (r.start_date && r.end_date) {
            const start = new Date(r.start_date);
            const end = new Date(r.end_date);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              raceDays.push(d.toISOString().split('T')[0]);
            }
          }
          return { ...r, status, raceDays };
        });

        this.setData({ allRaces: races });
        this.generateCalendar();
        this.loadUpcomingRaces(races);
      }
    } catch (err) {
      console.error('降级加载赛事失败:', err);
    }
  },

  /**
   * 生成日历数据
   */
  generateCalendar() {
    const { currentYear, currentMonth, allRaces } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();
    const today = formatDate(new Date());

    const calendarDays = [];

    // 上月填充
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        date: '',
        races: [],
        raceDots: []
      });
    }

    // 当前月
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // 找出该日期覆盖的所有赛事
      const dayRaces = allRaces.filter(r =>
        r.raceDays && r.raceDays.includes(date)
      );

      // 生成赛事颜色点
      const raceDots = dayRaces.map(r => ({
        color: this.getCategoryColor(r.category, r.status)
      }));

      calendarDays.push({
        day: d,
        isCurrentMonth: true,
        isToday: date === today,
        date,
        races: dayRaces,
        raceDots
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
        races: [],
        raceDots: []
      });
    }

    this.setData({
      calendarDays,
      monthText: `${currentYear}年${currentMonth}月`
    });
  },

  /**
   * 获取赛事类型颜色
   */
  getCategoryColor(category, status) {
    const colors = this.data.categoryColors;
    if (status === 'ongoing') return '#07c160'; // 进行中 = 绿色
    if (status === 'finished') return '#999'; // 已结束 = 灰色
    return colors[category] || '#3498db'; // 默认蓝色
  },

  /**
   * 加载即将开始的赛事
   */
  loadUpcomingRaces(races) {
    const now = new Date();
    const today = formatDate(now);

    const upcoming = (races || [])
      .filter(r => r.start_date >= today || r.status === 'upcoming')
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
      .slice(0, 5)
      .map(r => {
        if (!r.start_date) return { ...r, countdownText: '日期待定' };
        const raceDate = new Date(r.start_date);
        const diffMs = raceDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let countdownText = '';
        if (diffDays <= 0) {
          countdownText = '进行中';
        } else if (diffDays === 1) {
          countdownText = '明天';
        } else {
          countdownText = `${diffDays}天后`;
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
    this.setData({ currentYear, currentMonth, selectedDate: '', selectedRaces: [] });
    this.loadCalendarData();
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth, selectedDate: '', selectedRaces: [] });
    this.loadCalendarData();
  },

  // 回到今天
  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: '',
      selectedRaces: []
    });
    this.loadCalendarData();
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

  /**
   * 添加赛事到系统日历
   */
  addToCalendar(e) {
    const { race } = e.currentTarget.dataset;
    if (!race) return;

    wx.showModal({
      title: '添加到日历',
      content: `将"${race.race_name_zh || race.race_name}"添加到系统日历？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '已添加到日历',
            icon: 'success'
          });
          // TODO: 调用 wx.addPhoneCalendar 或服务端生成 .ics 文件
        }
      }
    });
  },

  /**
   * 获取赛事状态文本
   */
  getStatusText(status) {
    const statusMap = {
      ongoing: '进行中',
      upcoming: '即将开始',
      finished: '已结束'
    };
    return statusMap[status] || '';
  }
});
