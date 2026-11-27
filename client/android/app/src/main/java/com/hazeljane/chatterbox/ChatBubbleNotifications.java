package com.hazeljane.chatterbox;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.content.LocusIdCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.RemoteMessage;

public final class ChatBubbleNotifications {

    private static final String TAG = "ChatterboxBubbles";

    private static final String CHANNEL =
            "chatterbox_conversations";

    private ChatBubbleNotifications() {}

    private static String get(
            RemoteMessage message,
            String key
    ) {
        String value = message.getData().get(key);
        return value == null ? "" : value.trim();
    }

    public static boolean isChatMessage(
            RemoteMessage message
    ) {
        String type = get(message, "type");

        return "private_message".equals(type)
                || "group_message".equals(type)
                || "message".equals(type)
                || "new_message".equals(type);
    }

    public static void show(
            Context context,
            RemoteMessage message
    ) {

        String type = get(message, "type");
        String conversationId = get(message, "conversationId");
        String groupId = get(message, "groupId");
        String senderId = get(message, "senderId");

        boolean isGroup =
                "group_message".equals(type)
                        || !groupId.isEmpty();

        String targetId;

        if (isGroup) {
            targetId = groupId;
        } else {
            targetId = !conversationId.isEmpty()
                    ? conversationId
                    : senderId;
        }

        if (TextUtils.isEmpty(targetId)) {
            Log.w(TAG, "Missing conversation identifier");
            PushNotificationsPlugin.sendRemoteMessage(message);
            return;
        }

        String senderName = get(message, "senderName");
        String groupName = get(message, "groupName");

        String title = isGroup && !groupName.isEmpty()
                ? groupName
                : senderName;

        if (title.isEmpty()
                && message.getNotification() != null) {
            title = message.getNotification().getTitle();
        }

        if (title == null || title.isEmpty()) {
            title = "Chatterbox";
        }

        String body = get(message, "body");

        if (body.isEmpty()
                && message.getNotification() != null) {
            body = message.getNotification().getBody();
        }

        if (body == null || body.isEmpty()) {
            body = "New message";
        }

        String shortcutId =
                (isGroup ? "group_" : "private_") + targetId;

        int notificationId =
                shortcutId.hashCode() & 0x7fffffff;

        NotificationManager manager =
                (NotificationManager) context.getSystemService(
                        Context.NOTIFICATION_SERVICE
                );

        if (manager == null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED) {

            Log.w(TAG, "Notification permission not granted");
            return;
        }

        if (Build.VERSION.SDK_INT >= 26) {

            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL,
                            "Chat conversations",
                            NotificationManager.IMPORTANCE_HIGH
                    );

            channel.setDescription(
                    "Private and group message conversations"
            );

            if (Build.VERSION.SDK_INT >= 29) {
                channel.setAllowBubbles(true);
            }

            manager.createNotificationChannel(channel);
        }

        Bitmap avatar = createAvatar(title);

        IconCompat avatarIcon =
                IconCompat.createWithBitmap(avatar);

        Intent intent = new Intent(
                context,
                ChatBubbleActivity.class
        );

        intent.setAction(
                "com.hazeljane.chatterbox.OPEN_CHAT."
                        + shortcutId
        );

        intent.putExtra("type", type);
        intent.putExtra("conversationId", conversationId);
        intent.putExtra("groupId", groupId);
        intent.putExtra("senderId", senderId);

        intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_MULTIPLE_TASK
        );

        // Android bubbles require a mutable PendingIntent.
        PendingIntent pending = PendingIntent.getActivity(
                context,
                notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT
                        | PendingIntent.FLAG_MUTABLE
        );

        Person sender = new Person.Builder()
                .setName(
                        senderName.isEmpty()
                                ? title
                                : senderName
                )
                .setIcon(avatarIcon)
                .setKey(
                        senderId.isEmpty()
                                ? shortcutId
                                : senderId
                )
                .build();

        Person me = new Person.Builder()
                .setName("Me")
                .setKey("chatterbox_me")
                .build();

        if (Build.VERSION.SDK_INT >= 29) {

            ShortcutInfoCompat shortcut =
                    new ShortcutInfoCompat.Builder(
                            context,
                            shortcutId
                    )
                    .setShortLabel(title)
                    .setIcon(avatarIcon)
                    .setIntent(intent)
                    .setLongLived(true)
                    .setPerson(sender)
                    .setLocusId(
                            new LocusIdCompat(shortcutId)
                    )
                    .build();

            ShortcutManagerCompat.pushDynamicShortcut(
                    context,
                    shortcut
            );
        }

        NotificationCompat.MessagingStyle style =
                new NotificationCompat.MessagingStyle(me)
                        .addMessage(
                                body,
                                System.currentTimeMillis(),
                                sender
                        );

        if (isGroup) {
            style.setConversationTitle(title);
            style.setGroupConversation(true);
        }

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(
                        context,
                        CHANNEL
                )
                .setSmallIcon(
                        android.R.drawable.stat_notify_chat
                )
                .setLargeIcon(avatar)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(style)
                .setCategory(
                        NotificationCompat.CATEGORY_MESSAGE
                )
                .setShortcutId(shortcutId)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setPriority(
                        NotificationCompat.PRIORITY_HIGH
                );

        if (Build.VERSION.SDK_INT >= 30) {

            NotificationCompat.BubbleMetadata bubble =
                    new NotificationCompat.BubbleMetadata.Builder(
                            pending,
                            avatarIcon
                    )
                    .setDesiredHeight(650)
                    .setAutoExpandBubble(false)
                    .setSuppressNotification(false)
                    .build();

            builder.setBubbleMetadata(bubble);
        }

        try {
            manager.notify(
                    notificationId,
                    builder.build()
            );

            Log.d(
                    TAG,
                    "Conversation notification posted: "
                            + shortcutId
            );

        } catch (SecurityException exception) {
            Log.w(
                    TAG,
                    "Unable to post notification",
                    exception
            );
        }
    }

    private static Bitmap createAvatar(String name) {

        Bitmap bitmap = Bitmap.createBitmap(
                128,
                128,
                Bitmap.Config.ARGB_8888
        );

        Canvas canvas = new Canvas(bitmap);

        Paint paint = new Paint(
                Paint.ANTI_ALIAS_FLAG
        );

        paint.setColor(
                Color.rgb(45, 111, 218)
        );

        canvas.drawCircle(
                64,
                64,
                64,
                paint
        );

        paint.setColor(Color.WHITE);
        paint.setTextAlign(Paint.Align.CENTER);

        paint.setTypeface(
                android.graphics.Typeface.create(
                        "sans-serif-medium",
                        android.graphics.Typeface.BOLD
                )
        );

        paint.setTextSize(64);

        String initial = name.isEmpty()
                ? "C"
                : name.substring(0, 1).toUpperCase();

        canvas.drawText(
                initial,
                64,
                86,
                paint
        );

        return bitmap;
    }
}
