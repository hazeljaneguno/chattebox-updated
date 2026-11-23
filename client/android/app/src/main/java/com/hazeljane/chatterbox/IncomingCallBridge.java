package com.hazeljane.chatterbox;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

@CapacitorPlugin(name = "IncomingCallBridge")
public class IncomingCallBridge extends Plugin {

    private static final String TAG = "IncomingCallBridge";

    private static final String PREFS_NAME =
            "chatterbox_incoming_call";

    private static final String KEY_PENDING_ACTION =
            "pending_action";

    private static final String KEY_TOKEN = "token";
    private static final String KEY_API_URL = "apiUrl";

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
        );
    }

    public static void savePendingAction(
            Context context,
            JSObject data
    ) {
        if (context == null || data == null) {
            return;
        }

        SharedPreferences preferences =
                context.getSharedPreferences(
                        PREFS_NAME,
                        Context.MODE_PRIVATE
                );

        preferences.edit()
                .putString(KEY_PENDING_ACTION, data.toString())
                .apply();
    }

    @PluginMethod
    public void configureSession(PluginCall call) {
        try {
            String token = call.getString(KEY_TOKEN, "");
            String apiUrl = call.getString(KEY_API_URL, "");

            if (token == null) token = "";
            if (apiUrl == null) apiUrl = "";

            boolean saved = getPreferences()
                    .edit()
                    .putString(KEY_TOKEN, token)
                    .putString(KEY_API_URL, apiUrl)
                    .commit();

            if (!saved) {
                call.reject("Could not save native session.");
                return;
            }

            Log.d(TAG, "Native session configured. Has token: "
                    + !token.isEmpty());

            call.resolve();

        } catch (Exception exception) {
            Log.e(TAG, "Session configuration failed", exception);
            call.reject(
                    "Session configuration failed.",
                    exception
            );
        }
    }


@PluginMethod
public void getPendingAction(PluginCall call) {
    try {
        SharedPreferences preferences = getPreferences();

        String savedAction = preferences.getString(
                KEY_PENDING_ACTION,
                null
        );

        if (savedAction == null) {
            call.resolve(new JSObject());
            return;
        }

        try {
            JSObject action = new JSObject(savedAction);
            call.resolve(action);

        } catch (JSONException exception) {
            Log.e(TAG, "Invalid pending action", exception);

            preferences.edit()
                    .remove(KEY_PENDING_ACTION)
                    .apply();

            call.reject(
                    "Could not read the saved incoming call action.",
                    exception
            );
        }

    } catch (Exception exception) {
        Log.e(TAG, "Failed to retrieve pending action", exception);

        call.reject(
                "Failed to retrieve pending action.",
                exception
        );
    }
}


    @PluginMethod
    public void clearPendingAction(PluginCall call) {
        try {
            boolean cleared = getPreferences()
                    .edit()
                    .remove(KEY_PENDING_ACTION)
                    .commit();

            if (!cleared) {
                call.reject("Could not clear pending action.");
                return;
            }

            call.resolve();

        } catch (Exception exception) {
            Log.e(TAG, "Could not clear pending action", exception);
            call.reject(
                    "Could not clear pending action.",
                    exception
            );
        }
    }
}
