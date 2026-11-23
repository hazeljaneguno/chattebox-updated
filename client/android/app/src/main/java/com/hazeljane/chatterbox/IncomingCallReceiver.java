
package com.hazeljane.chatterbox;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class IncomingCallReceiver extends BroadcastReceiver {

    private static final String TAG = "ChatterboxCalls";

    private static final String PREFS_NAME =
            "chatterbox_incoming_call";

    private static final int TIMEOUT_MS = 5000;

    @Override
    public void onReceive(Context context, Intent intent) {

        if (intent == null ||
                !IncomingCallNotifications.ACTION_DECLINE.equals(
                        intent.getAction())) {
            return;
        }

        String callId = intent.getStringExtra("callId");

        if (callId == null ||
                !callId.matches("[a-fA-F0-9]{24}")) {

            Log.w(TAG, "Invalid decline call ID.");
            return;
        }

        String groupId = intent.getStringExtra("groupId");

        IncomingCallNotifications.dismiss(context, callId);

        final PendingResult pendingResult = goAsync();

        Context appContext = context.getApplicationContext();

        new Thread(() -> {

            HttpURLConnection connection = null;

            try {
                SharedPreferences preferences =
                        appContext.getSharedPreferences(
                                PREFS_NAME,
                                Context.MODE_PRIVATE
                        );

                String token = preferences.getString("token", "");
                String apiUrl = preferences.getString("apiUrl", "");

                if (token == null || token.isEmpty()) {
                    Log.w(TAG, "Decline failed: no session token.");
                    return;
                }

                if (apiUrl == null || apiUrl.isEmpty()) {
                    Log.w(TAG, "Decline failed: API URL missing.");
                    return;
                }

                URL baseUrl = new URL(apiUrl);

                if (!"https".equalsIgnoreCase(
                        baseUrl.getProtocol())) {
                    Log.w(TAG, "Decline failed: HTTPS required.");
                    return;
                }

                if (baseUrl.getHost() == null ||
                        baseUrl.getHost().isEmpty() ||
                        baseUrl.getUserInfo() != null ||
                        baseUrl.getQuery() != null ||
                        baseUrl.getRef() != null ||
                        (!baseUrl.getPath().isEmpty()
                                && !"/".equals(baseUrl.getPath()))) {
                    Log.w(TAG, "Decline failed: invalid API URL.");
                    return;
                }

                URL requestUrl = new URL(
                        baseUrl.toExternalForm().replaceAll("/+$", "")
                                + "/api/call-actions/"
                                + callId
                                + "/decline"
                );

                connection =
                        (HttpURLConnection) requestUrl.openConnection();

                connection.setRequestMethod("POST");
                connection.setConnectTimeout(TIMEOUT_MS);
                connection.setReadTimeout(TIMEOUT_MS);

                connection.setRequestProperty(
                        "Authorization",
                        "Bearer " + token
                );

                connection.setRequestProperty(
                        "X-Chatterbox-Native",
                        "android"
                );

                connection.setRequestProperty(
                        "Content-Type",
                        "application/json"
                );

                connection.setDoOutput(true);

                JSONObject body = new JSONObject();

                if (groupId != null && !groupId.isEmpty()) {
                    body.put("groupId", groupId);
                }

                byte[] requestBody =
                        body.toString().getBytes(
                                StandardCharsets.UTF_8
                        );

                try (OutputStream output =
                             connection.getOutputStream()) {
                    output.write(requestBody);
                }

                int statusCode = connection.getResponseCode();

                if (statusCode >= 200 && statusCode < 300) {
                    Log.d(TAG, "Call declined successfully.");
                } else {
                    Log.w(
                            TAG,
                            "Decline rejected. HTTP " + statusCode
                    );
                }

            } catch (Exception exception) {

                Log.e(
                        TAG,
                        "Could not decline incoming call.",
                        exception
                );

            } finally {

                if (connection != null) {
                    connection.disconnect();
                }

                pendingResult.finish();
            }

        }, "ChatterboxDecline").start();
    }
}
