'use strict';
const Install         = require('./class/Install');
const User            = require('./class/User');
const Gallery         = require('./class/Gallery');
const GalleryAlbum    = require('./class/GalleryAlbum');
const GalleryActivity = require('./class/GalleryActivity');
const GalleryComment  = require('./class/GalleryComment');
const ChatChannel     = require('./class/ChatChannel');
const ChatMessage     = require('./class/ChatMessage');
const Dashboard       = require('./class/Dashboard');
const Push            = require('./class/Push');

// Parse Push Android
let PUSH_ANDROID_SENDER  = process.env.PUSH_ANDROID_SENDER;
let PUSH_ANDROID_API_KEY = process.env.PUSH_ANDROID_API_KEY;


// Push
Parse.Cloud.define('verifyServerConnection', Push.verifyServerConnection);
Parse.Cloud.define('pushText', Push.pushText);
Parse.Cloud.define('pushChat', Push.pushChat);

// Install
Parse.Cloud.define('status', Install.status);
Parse.Cloud.define('install', Install.start);

// Chat Channel
Parse.Cloud.define('getChatChannel', ChatChannel.getChatChannel);
Parse.Cloud.define('getChatChannels', ChatChannel.getChatChannels);
Parse.Cloud.define('createChatChannel', ChatChannel.createChatChannel);

// Chat Message
Parse.Cloud.define('createMessage', ChatMessage.createMessage);
Parse.Cloud.define('getChatMessages', ChatMessage.getMessages);
// If the push is set
if (PUSH_ANDROID_API_KEY && PUSH_ANDROID_SENDER) {
  Parse.Cloud.afterSave('ChatMessage', ChatMessage.afterSave);
}


// Admin Dashboard
Parse.Cloud.define('dashboard', Dashboard.home);

// GalleryActivity
Parse.Cloud.define('feedActivity', GalleryActivity.feed);

// If the push is set
if (PUSH_ANDROID_API_KEY && PUSH_ANDROID_SENDER) {
  Parse.Cloud.afterSave('GalleryActivity', GalleryActivity.afterSave);
}

// User
Parse.Cloud.beforeSave(Parse.User, User.beforeSave);
Parse.Cloud.afterSave(Parse.User, User.afterSave);
Parse.Cloud.afterDelete(Parse.User, User.afterDelete);

Parse.Cloud.define('findUserByUsername', User.findUserByUsername);
Parse.Cloud.define('findUserByEmail', User.findUserByEmail);
Parse.Cloud.define('profile', User.profile);
Parse.Cloud.define('followUser', User.follow);
Parse.Cloud.define('getLikers', User.getLikers);
Parse.Cloud.define('getFollowers', User.getFollowers);
Parse.Cloud.define('getFollowing', User.getFollowing);
Parse.Cloud.define('getUsers', User.getUsers);
Parse.Cloud.define('listUsers', User.listUsers);
Parse.Cloud.define('createUser', User.createUser);
Parse.Cloud.define('updateUser', User.updateUser);
Parse.Cloud.define('destroyUser', User.destroyUser);
Parse.Cloud.define('saveFacebookPicture', User.saveFacebookPicture);
Parse.Cloud.define('validateUsername', User.validateUsername);
Parse.Cloud.define('validateEmail', User.validateEmail);

// Gallery Album
Parse.Cloud.beforeSave('GalleryAlbum', GalleryAlbum.beforeSave);
Parse.Cloud.afterSave('GalleryAlbum', GalleryAlbum.afterSave);
Parse.Cloud.afterDelete('GalleryAlbum', GalleryAlbum.afterDelete);
Parse.Cloud.define('listAlbum', GalleryAlbum.list);

// Gallery
Parse.Cloud.beforeSave('Gallery', Gallery.beforeSave);
Parse.Cloud.afterSave('Gallery', Gallery.afterSave);
Parse.Cloud.afterDelete('Gallery', Gallery.afterDelete);
Parse.Cloud.define('createGallery', Gallery.createGallery);
Parse.Cloud.define('searchGallery', Gallery.search);
Parse.Cloud.define('getAlbum', Gallery.getAlbum);
Parse.Cloud.define('feedGallery', Gallery.feed);
Parse.Cloud.define('commentGallery', Gallery.commentGallery);
Parse.Cloud.define('getGallery', Gallery.getGallery);
Parse.Cloud.define('likeGallery', Gallery.likeGallery);
Parse.Cloud.define('isGalleryLiked', Gallery.isGalleryLiked);
Parse.Cloud.define('updateGallery', Gallery.updateGallery);
Parse.Cloud.define('destroyGallery', Gallery.destroyGallery);

// GalleryComment
Parse.Cloud.beforeSave('GalleryComment', GalleryComment.beforeSave);
Parse.Cloud.afterSave('GalleryComment', GalleryComment.afterSave);
Parse.Cloud.define('getComments', GalleryComment.getComments);
