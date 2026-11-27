package com.hazeljane.chatterbox;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Size;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "RecentPhotos", permissions = {
    @Permission(alias = "legacy", strings = Manifest.permission.READ_EXTERNAL_STORAGE),
    @Permission(alias = "images", strings = Manifest.permission.READ_MEDIA_IMAGES),
    @Permission(alias = "selected", strings = Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
})
public class RecentPhotosPlugin extends Plugin {
    private static final int MAX_FILE_BYTES = 10 * 1024 * 1024;
    private static final int MAX_PHOTOS = 24;
    private static final Uri IMAGES = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;

    private boolean granted(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private String access() {
        String permission = Build.VERSION.SDK_INT >= 33
                ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
        if (granted(permission)) return "full";
        if (Build.VERSION.SDK_INT >= 34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)) {
            return "limited";
        }
        return "denied";
    }

    @PluginMethod
    public void list(PluginCall call) {
        if (!"denied".equals(access()) && !Boolean.TRUE.equals(call.getBoolean("manage"))) {
            loadPhotos(call);
            return;
        }
        if (!Boolean.TRUE.equals(call.getBoolean("request")) && !Boolean.TRUE.equals(call.getBoolean("manage"))) {
            loadPhotos(call);
            return;
        }
        String[] aliases = Build.VERSION.SDK_INT >= 34 ? new String[]{"images", "selected"}
                : Build.VERSION.SDK_INT >= 33 ? new String[]{"images"} : new String[]{"legacy"};
        requestPermissionForAliases(aliases, call, "galleryPermissionResult");
    }

    @PermissionCallback
    private void galleryPermissionResult(PluginCall call) {
        loadPhotos(call);
    }

    private void loadPhotos(PluginCall call) {
        bridge.execute(() -> {
            String access = access();
            JSArray photos = new JSArray();
            JSArray albums = new JSArray();
            String albumId = call.getString("albumId", "");
            String bucketId = MediaStore.Images.Media.BUCKET_ID;
            String bucketName = MediaStore.Images.Media.BUCKET_DISPLAY_NAME;
            ContentResolver resolver = getContext().getContentResolver();
            if (!"denied".equals(access)) {
                Set<String> albumIds = new HashSet<>();
                try (Cursor cursor = resolver.query(IMAGES, new String[]{bucketId, bucketName},
                        null, null, bucketName + " ASC")) {
                    while (cursor != null && cursor.moveToNext()) {
                        String id = cursor.getString(0);
                        String name = cursor.getString(1);
                        if (id == null || name == null || name.trim().isEmpty() || !albumIds.add(id)) continue;

                        JSObject album = new JSObject();
                        album.put("id", id);
                        album.put("name", name);
                        albums.put(album);
                    }
                } catch (RuntimeException error) {
                    call.reject("Could not load albums. Try Browse photos.");
                    return;
                }

                if (!albumIds.contains(albumId)) albumId = "";
                String selection = albumId.isEmpty() ? null : bucketId + " = ?";
                String[] arguments = albumId.isEmpty() ? null : new String[]{albumId};
                try (Cursor cursor = resolver.query(IMAGES,
                        new String[]{MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME},
                        selection, arguments, MediaStore.Images.Media.DATE_ADDED + " DESC, " + MediaStore.Images.Media._ID + " DESC")) {
                    while (cursor != null && photos.length() < MAX_PHOTOS && cursor.moveToNext()) {
                        long id = cursor.getLong(0);
                        Uri uri = ContentUris.withAppendedId(IMAGES, id);
                        try {
                            Bitmap thumbnail = Build.VERSION.SDK_INT >= 29
                                    ? resolver.loadThumbnail(uri, new Size(150, 150), null)
                                    : MediaStore.Images.Thumbnails.getThumbnail(
                                            resolver, id, MediaStore.Images.Thumbnails.MINI_KIND, null);
                            if (thumbnail == null) continue;
                            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                            try {
                                thumbnail.compress(Bitmap.CompressFormat.JPEG, 75, bytes);
                            } finally {
                                thumbnail.recycle();
                            }
                            JSObject photo = new JSObject();
                            photo.put("id", String.valueOf(id));
                            photo.put("name", cursor.getString(1));
                            photo.put("thumbnail", "data:image/jpeg;base64," +
                                    Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                            photos.put(photo);
                        } catch (IOException | SecurityException ignored) {
                            // A photo can disappear or lose access while the gallery is loading.
                        }
                    }
                } catch (RuntimeException error) {
                    call.reject("Could not load recent photos. Try Browse photos.");
                    return;
                }
            }
            JSObject result = new JSObject();
            result.put("access", access);
            result.put("photos", photos);
            result.put("albums", albums);
            result.put("albumId", "denied".equals(access) ? "" : albumId);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void readPhoto(PluginCall call) {
        String id = call.getString("id", "");
        if (!id.matches("[0-9]{1,18}")) {
            call.reject("Invalid photo.");
            return;
        }
        readUri(call, ContentUris.withAppendedId(IMAGES, Long.parseLong(id)));
    }

    @PluginMethod
    public void browse(PluginCall call) {
        Intent intent = new Intent(MediaStore.ACTION_PICK_IMAGES).setType("image/*");
        if (Build.VERSION.SDK_INT < 33) {
            intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
        }
        try {
            startActivityForResult(call, intent, "browseResult");
        } catch (RuntimeException error) {
            call.reject("Could not open the photo picker.");
        }
    }

    @ActivityCallback
    private void browseResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.resolve();
            return;
        }
        readUri(call, data.getData());
    }

    private void readUri(PluginCall call, Uri uri) {
        bridge.execute(() -> {
            ContentResolver resolver = getContext().getContentResolver();
            try {
                String mime = resolver.getType(uri);
                String extension;
                if ("image/jpeg".equals(mime)) extension = ".jpg";
                else if ("image/png".equals(mime)) extension = ".png";
                else if ("image/gif".equals(mime)) extension = ".gif";
                else if ("image/webp".equals(mime)) extension = ".webp";
                else {
                    call.reject("Choose a JPG, PNG, GIF, or WebP photo.");
                    return;
                }

                String name = "photo" + extension;
                try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME},
                        null, null, null)) {
                    if (cursor != null && cursor.moveToFirst() && cursor.getString(0) != null) {
                        name = cursor.getString(0).replaceFirst("\\.[^.]+$", "") + extension;
                    }
                }
                try (InputStream stream = resolver.openInputStream(uri);
                     ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    if (stream == null) throw new IOException("Photo unavailable");
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = stream.read(buffer)) != -1) {
                        if (bytes.size() + count > MAX_FILE_BYTES) {
                            call.reject("Photo must be 10 MB or smaller.");
                            return;
                        }
                        bytes.write(buffer, 0, count);
                    }
                    JSObject result = new JSObject();
                    result.put("name", name);
                    result.put("type", mime);
                    result.put("data", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                    call.resolve(result);
                }
            } catch (IOException | RuntimeException error) {
                call.reject("Could not open this photo. Try choosing it again.");
            }
        });
    }
}
