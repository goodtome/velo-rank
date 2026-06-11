const feedbackConfig = require('../../config/feedback');

Page({
  data: {
    sheetName: feedbackConfig.feedbackSheetName || '意见反馈表',
    sheetUrl: feedbackConfig.feedbackSheetUrl || '',
    tips: feedbackConfig.feedbackTips || [],
    hasSheetUrl: false,
    copied: false
  },

  onLoad() {
    this.setData({
      hasSheetUrl: !!this.data.sheetUrl
    });
  },

  copySheetUrl() {
    const { sheetUrl } = this.data;

    if (!sheetUrl) {
      wx.showToast({
        title: '请先配置飞书链接',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: sheetUrl,
      success: () => {
        this.setData({ copied: true });
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });

        setTimeout(() => {
          this.setData({ copied: false });
        }, 2000);
      },
      fail: () => {
        wx.showToast({
          title: '复制失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }

    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  onShareAppMessage() {
    return {
      title: '意见反馈 - 正一领骑',
      path: '/pages/help-feedback/help-feedback'
    };
  }
});
