const fs = require('fs');
const path = require('path');

const zhDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));
const enDict = JSON.parse(fs.readFileSync(enDictPath, 'utf8'));

// Update common for Layout / Header
zhDict.common.settings = "设置";
zhDict.common.logout = "退出登录";
enDict.common.settings = "Settings";
enDict.common.logout = "Logout";

// Update profile for Bookmarks
zhDict.profile.bookmarks = "书签";
enDict.profile.bookmarks = "Bookmarks";

// Update category pages
zhDict.category = {
  postsTitle: "帖子",
  showingPostsFor: "显示分类下的帖子：",
  noPostsFound: "该分类下暂无帖子。",
  noPostsFoundGeneral: "暂无帖子。"
};

enDict.category = {
  postsTitle: "Posts",
  showingPostsFor: "Showing posts for category: ",
  noPostsFound: "No posts found in this category.",
  noPostsFoundGeneral: "No posts found."
};

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
fs.writeFileSync(enDictPath, JSON.stringify(enDict, null, 2), 'utf8');
console.log('Dictionaries updated with missing texts from screenshots.');
