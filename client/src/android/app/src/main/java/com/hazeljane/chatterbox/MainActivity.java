package com.hazeljane.chatterbox;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ChatterboxCalls";
    private static final String FIREBASE_TAG = "ChatterboxFirebase";

    private static final String EVENT_INCOMING_CALL =
            "chatterboxIncomingCallAction";

    private static final String MESSAGE_CHANNEL_ID =
            "chatterbox_messages";

    @Override
    public void onCreate(Bundle savedInstanceState) {

        // Register the custom plugin before Capacitor starts.
        // Remove this line if IncomingCallBridge is already
        // registered automatically elsewhere.
        registerPlugin(IncomingCallBridge.class);
        registerPlugin(RecentPhotosPlugin.class);
        registerPlugin(SocialBridge.class);

        super.onCreate(savedInstanceState);

        boolean isDebuggable =
                (getApplicationInfo().flags
                        & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

        WebView.setWebContentsDebuggingEnabled(isDebuggable);

        // Check Firebase configuration.
        FirebaseApp firebaseApp = FirebaseApp.initializeApp(this);

        if (firebaseApp != null) {
            Log.d(
                    FIREBASE_TAG,
                    "Firebase initialized successfully."
            );
        } else {
            Log.e(
                    FIREBASE_TAG,
                    "Firebase initialization failed. "
                            + "Check google-services.json and Gradle."
            );
        }

        // Create notification channels.
        createNotificationChannel();
        IncomingCallNotifications.createChannel(this);

        // Recover notification action when launched from a call.
        handleIncomingCallIntent(getIntent());

        Log.d(TAG, "MainActivity initialized successfully.");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (intent == null) {
            return;
        }

        setIntent(intent);
        handleIncomingCallIntent(intent);
    }

    private void handleIncomingCallIntent(Intent intent) {

        if (intent == null) {
            return;
        }

        String action = intent.getStringExtra(
                IncomingCallNotifications.EXTRA_CALL_ACTION
        );

        String callId = intent.getStringExtra(
                IncomingCallNotifications.EXTRA_CALL_ID
        );

        if (action == null || action.trim().isEmpty()
                || callId == null || callId.trim().isEmpty()) {
            return;
        }

        try {
            String callerName = intent.getStringExtra(
                    IncomingCallNotifications.EXTRA_CALLER_NAME
            );

            String callType = intent.getStringExtra(
                    IncomingCallNotifications.EXTRA_CALL_TYPE
            );

            String type = intent.getStringExtra("type");
            String groupId = intent.getStringExtra("groupId");
            String groupName = intent.getStringExtra("groupName");

            JSObject data = new JSObject();

            data.put(
                    "type",
                    type == null || type.isEmpty()
                            ? "incoming_call"
                            : type
            );

            data.put("action", action);
            data.put("callId", callId);
            data.put("groupId", groupId);
            data.put("groupName", groupName);

            data.put(
                    "callerName",
                    callerName == null || callerName.isEmpty()
                            ? "Someone"
                            : callerName
            );

            data.put(
                    "callType",
                    callType == null || callType.isEmpty()
                            ? "audio"
                            : callType
            );

            // Save the action first, so it survives a cold start.
            IncomingCallBridge.savePendingAction(this, data);

            Log.d(TAG, "Incoming call action saved: " + action);

            // Dispatch when the bridge exists.
            // React must also read the saved pending action,
            // because its event listener might not be ready yet.
            if (getBridge() != null) {
                getBridge().triggerWindowJSEvent(
                        EVENT_INCOMING_CALL,
                        data.toString()
                );

                Log.d(TAG, "Incoming call event dispatched.");
            } else {
                Log.d(
                        TAG,
                        "Bridge not ready; action saved for recovery."
                );
            }

            // Dismiss notification after saving the action.
            IncomingCallNotifications.dismiss(this, callId);

            // Prevent processing the same intent again.
            intent.removeExtra(
                    IncomingCallNotifications.EXTRA_CALL_ACTION
            );
            intent.removeExtra(
                    IncomingCallNotifications.EXTRA_CALL_ID
            );

        } catch (Exception exception) {
            Log.e(
                    TAG,
                    "Unable to process incoming call action",
                    exception
            );
        }
    }

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(
                        Context.NOTIFICATION_SERVICE
                );

        if (notificationManager == null) {
            Log.e(TAG, "NotificationManager unavailable.");
            return;
        }

        NotificationChannel silentChannel = new NotificationChannel(
                "messages_silent", "Silent messages", NotificationManager.IMPORTANCE_LOW);
        silentChannel.setSound(null, null);
        silentChannel.enableVibration(false);
        notificationManager.createNotificationChannel(silentChannel);

        // Preserve an existing notification channel.
        NotificationChannel existingChannel =
                notificationManager.getNotificationChannel(
                        MESSAGE_CHANNEL_ID
                );

        if (existingChannel != null) {
            Log.d(TAG, "Message notification channel already exists.");
            return;
        }

        Uri soundUri = Uri.parse(
                "android.resource://"
                        + getPackageName()
                        + "/"
                        + R.raw.chatterbox_notification
        );

        AudioAttributes audioAttributes =
                new AudioAttributes.Builder()
                        .setUsage(
                                AudioAttributes.USAGE_NOTIFICATION
                        )
                        .build();

        NotificationChannel channel =
                new NotificationChannel(
                        MESSAGE_CHANNEL_ID,
                        "Chatterbox Messages",
                        NotificationManager.IMPORTANCE_HIGH
                );

        channel.setDescription(
                "New chat message notifications"
        );

        channel.setSound(
                soundUri,
                audioAttributes
        );

        notificationManager.createNotificationChannel(channel);

        Log.d(TAG, "Message notification channel created.");
    }

    private void createBubbleNotificationChannel() {

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) getSystemService(
                        Context.NOTIFICATION_SERVICE
                );

        if (manager == null) {
            Log.e(TAG, "NotificationManager unavailable.");
            return;
        }

        String channelId = "chatterbox_conversations";

        NotificationChannel existing =
                manager.getNotificationChannel(channelId);

        if (existing != null) {
            Log.d(TAG, "Conversation channel already exists.");
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        channelId,
                        "Chatterbox Conversations",
                        NotificationManager.IMPORTANCE_HIGH
                );

        channel.setDescription(
                "Private and group chat conversation notifications"
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            channel.setAllowBubbles(true);
        }

        manager.createNotificationChannel(channel);

        Log.d(TAG, "Conversation notification channel created.");
    }

}
