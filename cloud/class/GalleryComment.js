'use strict';
const Image       = require('../helpers/image');
const ParseObject = Parse.Object.extend('GalleryComment');
module.exports    = {
    beforeSave: beforeSave,
    afterSave : afterSave
};

function beforeSave(req, res) {
    var comment  = req.object;
    var user     = req.user;
    var userData = comment.get('userData');
    var gallery  = comment.get('gallery');

    if (!user) {
        return res.error('Not Authorized');
    }

    if (!comment.existed()) {
        var acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setRoleWriteAccess('Admin', true);
        acl.setWriteAccess(user, true);
        comment.setACL(acl);
        comment.set('isInappropriate', false);
    }

    if (comment.existed() && comment.dirty('isInappropriate')) {
        return res.success();
    }

    new Parse
        .Query('GalleryComment')
        .equalTo('userData', userData)
        .equalTo('gallery', gallery)
        .find({
            success: res1 => {
                if (res1.length > 0) {
                    res.error('You already write a comment for this gallery');
                } else {

                    if (comment.get('rating') < 1) {
                        res.error('You cannot give less than one star');
                    } else if (comment.get('rating') > 5) {
                        res.error('You cannot give more than five stars');
                    } else {
                        res.success();
                    }
                }
            },
            error  : (obj, error) => {
                res.error(error);
            }
        });
}

function afterSave(req, res) {
    const User    = req.user;
    const comment = req.object;
    var rating    = comment.get('rating');
    var galleryId = comment.get('gallery').id;

    new Parse
        .Query('Gallery')
        .get(galleryId).then(gallery => {

        var currentTotalRating = gallery.get('commentsTotal') || 0;

        gallery.increment('commentsTotal');
        gallery.set('user', User);
        gallery.save(null, {useMasterKey: true});

    }, error=>console.log('Got an error ' + error.code + ' : ' + error.message));

}