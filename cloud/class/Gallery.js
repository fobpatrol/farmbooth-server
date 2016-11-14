'use strict';
const _               = require('lodash');
const Image           = require('./../helpers/image');
const User            = require('./../class/User');
const GalleryActivity = require('./../class/GalleryActivity');
const ParseObject     = Parse.Object.extend('Gallery');
const GalleryAlbum    = Parse.Object.extend('GalleryAlbum');
const UserFollow      = Parse.Object.extend('UserFollow');
const MasterKey       = {useMasterKey: true};

module.exports = {
    beforeSave    : beforeSave,
    afterSave     : afterSave,
    afterDelete   : afterDelete,
    feed          : feed,
    search        : search,
    getAlbum      : getAlbum,
    commentGallery: commentGallery,
    isGalleryLiked: isGalleryLiked,
    likeGallery   : likeGallery,
};


function beforeSave(req, res) {
    const gallery = req.object;
    const user    = req.user || req.object.get('user');

    if (!user) {
        return res.error('Not Authorized');
    }

    //if (gallery.existed()) {
    //    if (!req.user) {
    //        return res.error('Not Authorized');
    //    }
    //}

    if (!gallery.get('image')) {
        return res.error('Upload the first image');
    }

    //if (!gallery.get('title')) {
    //    return res.error('Need image title');
    //}

    if (!gallery.dirty('image')) {
        return res.success();
    }

    // Search Gallery
    //https://parse.com/docs/js/guide#performance-implement-efficient-searches
    let toLowerCase = w => w.toLowerCase();
    var words       = gallery.get('title').split(/\b/);
    words           = _.map(words, toLowerCase);
    var stopWords   = ['the', 'in', 'and']
    words           = _.filter(words, w => w.match(/^\w+$/) && !_.includes(stopWords, w));
    var hashtags    = gallery.get('title').match(/#.+?\b/g);
    hashtags        = _.map(hashtags, toLowerCase)

    gallery.set('words', words);
    gallery.set('hashtags', hashtags);

    // Resize Image
    if (!gallery.existed()) {
        let imageUrl = gallery.get('image').url();
        console.log('Resize image', imageUrl);
        Image.resize(imageUrl, 640, 640).then(base64 => {
            return Image.saveImage(base64);
        }).then(savedFile => {
            gallery.set('image', savedFile);
            return Image.resize(imageUrl, 160, 160);
        }).then(base64 => {
            return Image.saveImage(base64);
        }).then(savedFile => {
            gallery.set('imageThumb', savedFile);

            gallery.increment('followersTotal', 0);
            gallery.increment('followingsTotal', 0);
            gallery.increment('likesTotal', 0);
            gallery.increment('galleriesTotal', 0);
            gallery.increment('commentsTotal', 0);
            gallery.increment('views', 0);

            new Parse.Query('UserData').equalTo('user', user).first(MasterKey).then(profile => {

                // Set default values
                gallery.set('user', user);
                gallery.set('isApproved', true);
                gallery.set('profile', profile);
                //gallery.setACL(new Parse.Parse.ACL(req.user));
                return res.success();
            });

        }).catch(res.error);
    } else {
        res.success();
    }
}

function afterDelete(req, res) {
    let deleteComments = new Parse.Query('GalleryComment').equalTo('gallery', req.object).find().then(results => {
        // Collect one promise for each delete into an array.
        let promises = [];
        _.each(results, result => {
            promises.push(result.destroy());
            User.decrementComment();
        });
        // Return a new promise that is resolved when all of the deletes are finished.
        return Parse.Promise.when(promises);

    });

    let deleteActivity = new Parse.Query('GalleryActivity').equalTo('gallery', req.object).find().then(results => {
        // Collect one promise for each delete into an array.
        let promises = [];
        _.each(results, result => {
            promises.push(result.destroy());
            User.decrementGallery();
        });
        // Return a new promise that is resolved when all of the deletes are finished.
        return Parse.Promise.when(promises);

    });

    let promises = [
        deleteActivity,
        deleteComments
    ];

    if (req.object.album) {
        let decrementAlbum = new Parse.Query('GalleryAlbum').equalTo('objectId', req.object.album.id)
                                                            .first(MasterKey).then(galleryAlbum => {
                return galleryAlbum.increment('qtyPhotos', -1).save(null, MasterKey)
            });
        promises.push(decrementAlbum);
    }

    Parse.Promise.when(promises).then(res.success).catch(res.error);


}

function afterSave(req) {
    const user = req.user;

    if (req.object.existed()) {
        return
    }

    // Add Album Relation
    if (req.object.attributes.album) {
        let _albumId = req.object.attributes.album.id;
        new Parse.Query('GalleryAlbum').get(_albumId).then(album => {
            let relation = album.relation('photos');
            relation.add(req.object);
            album.set('image', req.object.attributes.image);
            album.set('imageThumb', req.object.attributes.imageThumb);
            album.increment('qtyPhotos', 1);
            album.save(null, MasterKey);
        });
    }

    // Activity
    let activity = {
        action  : 'addPhoto',
        fromUser: user,
        toUser  : req.object.user,
        gallery : req.object
    };

    User.incrementGallery(user);
    GalleryActivity.create(activity);
}

function commentGallery(req, res) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 10;

    new Parse.Query(ParseObject)
        .equalTo('objectId', params.galleryId)
        .first()
        .then(gallery => {

            new Parse.Query('GalleryComment')
                .equalTo('gallery', gallery)
                .limit(_limit)
                .skip((_page * _limit) - _limit)
                .find(MasterKey)
                .then(data => {
                    let _result = [];

                    if (!data.length) {
                        res.success(_result);
                    }

                    let cb = _.after(data.length, () => {
                        res.success(_result);
                    });

                    _.each(data, itemComment => {

                        // User Data
                        let userGet = itemComment.get('user');
                        new Parse.Query('UserData').equalTo('user', userGet).first().then(user => {

                            // If not profile create profile
                            if (!itemComment.get('profile')) {
                                itemComment.set('profile', user);
                                itemComment.save();
                            }

                            // If not profile create profile
                            if (!gallery.get('profile')) {
                                gallery.set('profile', user);
                                gallery.save();
                            }

                            let obj = {
                                object   : itemComment,
                                id       : itemComment.id,
                                createdAt: itemComment.get('createdAt'),
                                text     : itemComment.get('text'),
                                user     : {
                                    obj     : itemComment.get('user'),
                                    username: user.get('username'),
                                    name    : user.get('name'),
                                    status  : user.get('status'),
                                    photo   : user.get('photo')
                                }
                            };
                            console.log('Obj', obj);

                            _result.push(obj);
                            cb();
                        }).catch(res.error);
                    });
                }).catch(res.error);
        });
}


function search(req, res, next) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    let _query = new Parse.Query(ParseObject);

    let text = params.search;

    if (text && text.length > 0) {
        let toLowerCase = w => w.toLowerCase();
        let words       = text.split(/\b/);
        words           = _.map(words, toLowerCase);

        let stopWords = ['the', 'in', 'and']
        words         = _.filter(words, w => w.match(/^\w+$/) && !_.includes(stopWords, w));

        let hashtags = text.match(/#.+?\b/g);
        hashtags     = _.map(hashtags, toLowerCase);

        if (words) {
            _query.containsAll('words', [words]);
        }

        if (hashtags) {
            _query.containsAll('hashtags', [hashtags]);
        }

    }

    _query
        .equalTo('isApproved', true)
        .descending('createdAt')
        .limit(_limit)
        .skip((_page * _limit) - _limit)
        .find(MasterKey)
        .then(data => {
            let _result = [];

            if (!data.length) {
                res.success(_result);
            }

            let cb = _.after(data.length, () => {
                res.success(_result);
            });

            _.each(data, itemGallery => {

                // User Data
                let userGet = itemGallery.get('user');
                new Parse.Query('UserData').equalTo('user', userGet).first({
                    useMasterKey: true
                }).then(user => {

                    let obj = {
                        id           : itemGallery.id,
                        galleryObj   : itemGallery,
                        comments     : [],
                        createdAt    : itemGallery.get('createdAt'),
                        image        : itemGallery.get('image'),
                        imageThumb   : itemGallery.get('imageThumb'),
                        title        : itemGallery.get('title'),
                        commentsTotal: itemGallery.get('commentsTotal') || 0,
                        likesTotal   : itemGallery.get('likesTotal') || 0,
                        views        : itemGallery.get('views') || 0,
                        isApproved   : itemGallery.get('isApproved'),
                        user         : {
                            obj     : itemGallery.get('user'),
                            name    : user.get('name'),
                            username: user.get('username'),
                            status  : user.get('status'),
                            photo   : user.get('photo')
                        }
                    };
                    //console.log('Obj', obj);

                    // Is Liked
                    new Parse.Query('Gallery')
                        .equalTo('likes', req.user)
                        .equalTo('objectId', itemGallery.id)
                        .first({
                            useMasterKey: true
                        })
                        .then(liked => {
                            obj.isLiked = liked ? true : false;

                            // Comments
                            new Parse.Query('GalleryComment')
                                .equalTo('gallery', itemGallery)
                                .limit(3)
                                .find({
                                    useMasterKey: true
                                })
                                .then(comments => {
                                    comments.map(function (comment) {
                                        obj.comments.push({
                                            id  : comment.id,
                                            obj : comment,
                                            user: {
                                                obj     : itemGallery.get('user'),
                                                name    : user.get('name'),
                                                username: user.get('username'),
                                                status  : user.get('status'),
                                                photo   : user.get('photo')
                                            },
                                            text: comment.get('text'),
                                        })
                                    });
                                    //console.log('itemGallery', itemGallery, user, comments);
                                    // Comments
                                    _result.push(obj);
                                    cb();

                                }).catch(res.error);
                        }).catch(res.error);
                }).catch(res.error);
            });
        }).catch(res.error);

}

function getAlbum(req, res) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    new Parse.Query(GalleryAlbum)
        .get(params.id)
        .then(album => {

            new Parse.Query(ParseObject)
                .descending('createdAt')
                .limit(_limit)
                .skip((_page * _limit) - _limit)
                .equalTo('album', album)
                .find(MasterKey)
                .then(photos => {
                    let result = {
                        album : album,
                        photos: photos
                    };
                    res.success(result);
                }).catch(res.error);

        }).catch(res.error);
}

function feed(req, res, next) {
    const params = req.params;
    const _page  = req.params.page || 1;
    const _limit = req.params.limit || 24;

    let _query = new Parse.Query(ParseObject);

    if (params.filter) {
        _query.contains('words', params.filter);
    }

    if (params.hashtags) {
        _query.containsAll("hashtags", [params.hashtags]);
    }

    if (params.id) {
        _query.equalTo('objectId', params.id);
    }

    if (params.username) {
        new Parse.Query(Parse.User)
            .equalTo('username', params.username)
            .first(MasterKey)
            .then(user => {
                _query.equalTo('user', user);
                _query.containedIn('privacity', ['', null, undefined, 'public']);
                runQuery();
            }, error => {
                runQuery();
            });
    } else {
        // Follow
        if (params.privacity === 'follow') {
            new Parse.Query(UserFollow)
                .equalTo('from', req.user)
                .include('user')
                .find(MasterKey)
                .then(users => {
                    let following = _.map(users, userFollow => {
                        return userFollow.get('to');
                    });
                    following.push(req.user);

                    _query.containedIn('user', following)
                    _query.containedIn('privacity', ['', null, undefined, 'public', 'follow']);
                    console.log(following);
                    runQuery();
                }).catch(res.error);
        }

        // Me
        if (params.privacity === 'me') {
            _query.containedIn('user', [req.user])
            runQuery();
        }

        // Public
        if (!params.privacity || params.privacity === 'public') {
            _query.containedIn('privacity', ['', null, undefined, 'public']);
            runQuery();
        }

    }


    function runQuery() {
        _query
            .equalTo('isApproved', true)
            .descending('createdAt')
            .limit(_limit)
            .skip((_page * _limit) - _limit)
            .include('album')
            .find(MasterKey)
            .then(_data => {
                let _result = [];

                if (!_data && !_data.length) {
                    res.success(_result);
                }

                let cb = _.after(_data.length, () => {
                    res.success(_result);
                });

                _.each(_data, _gallery => {

                    // User Data
                    const userGet = _gallery.get('user');
                    new Parse.Query('UserData').equalTo('user', userGet).first(MasterKey).then(_userData => {

                        let obj = {
                            id           : _gallery.id,
                            obj          : _gallery,
                            comments     : [],
                            album        : _gallery.get('album'),
                            createdAt    : _gallery.get('createdAt'),
                            image        : _gallery.get('image'),
                            imageThumb   : _gallery.get('imageThumb'),
                            location     : _gallery.get('location'),
                            title        : _gallery.get('title'),
                            commentsTotal: _gallery.get('commentsTotal') || 0,
                            likesTotal   : _gallery.get('likesTotal') || 0,
                            views        : _gallery.get('views') || 0,
                            isApproved   : _gallery.get('isApproved'),
                            user         : _userData
                        };
                        //console.log('Obj', obj);


                        // Is Liked
                        new Parse.Query('Gallery')
                            .equalTo('likes', req.user)
                            .equalTo('objectId', _gallery.id)
                            .first(MasterKey)
                            .then(liked => {
                                obj.isLiked = liked ? true : false;

                                // Comments
                                new Parse.Query('GalleryComment')
                                    .equalTo('gallery', _gallery)
                                    .limit(3)
                                    .include(['user'])
                                    .find(MasterKey)
                                    .then(_comments => {
                                        _comments.map(function (_comment) {
                                            obj.comments.push({
                                                id  : _comment.id,
                                                obj : _comment,
                                                user: _comment.get('user'),
                                                text: _comment.get('text'),
                                            })
                                        });
                                        //console.log('itemGallery', itemGallery, user, comments);
                                        // Comments
                                        _result.push(obj);

                                        // Incremment Gallery
                                        _gallery.increment('views');
                                        _gallery.save();
                                        cb();

                                    }, error => res.error(error.message));
                            }, error => res.error(error.message));
                    }).catch(res.error);
                });
            }).catch(res.error);
    }
}

function likeGallery(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    let objParse;
    let activity;
    let response = {action: null};

    new Parse.Query('Gallery').get(galleryId).then(gallery => {
        objParse = gallery;
        return new Parse.Query('Gallery')
            .equalTo('likes', user)
            .equalTo('objectId', galleryId)
            .find();
    }).then(result => {

        console.log('step1', result);
        let relation = objParse.relation('likes');

        console.log('step2', relation);
        console.log('step3', relation.length);

        if (result && result.length > 0) {
            objParse.increment('likesTotal', -1);
            relation.remove(user);
            response.action = 'unlike';
        } else {
            objParse.increment('likesTotal');
            relation.add(user);
            response.action = 'like';
        }

        activity = {
            fromUser: user,
            gallery : objParse,
            action  : response.action,
            toUser  : objParse.attributes.user
        };

        console.log('step4', activity);

        return objParse.save(null, MasterKey);

    }).then(data => {
        if (user.id != objParse.attributes.user.id) {
            GalleryActivity.create(activity);
        }
        res.success(response);
    }, error => res.error);
}

function isGalleryLiked(req, res, next) {
    const user      = req.user;
    const galleryId = req.params.galleryId;

    if (!user) {
        return res.error('Not Authorized');
    }

    new Parse.Query('Gallery')
        .equalTo('likes', user)
        .equalTo('objectId', galleryId)
        .first(MasterKey)
        .then(gallery => res.success(gallery ? true : false)).catch(res.error);
}

