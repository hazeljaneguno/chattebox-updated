package com.hazeljane.chatterbox;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SocialBridge")
public class SocialBridge extends Plugin {
    private static final String SOCIAL_PACKAGE = "com.chatterbox.social";

    @Override
    public void load() {
        publishDestination(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        publishDestination(intent);
    }

    @PluginMethod
    public void openSocial(PluginCall call) {
        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(SOCIAL_PACKAGE);
        if (launch == null) {
            call.reject("Install Chatterbox Social on this phone first.");
            return;
        }

        try {
            getActivity().startActivity(launch);
            call.resolve();
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("Chatterbox Social could not be opened.");
        }
    }

    private void publishDestination(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri data = intent.getData();
        if (data == null || !"chatterbox".equals(data.getScheme()) || !"open".equals(data.getHost())) return;
        String id = data.getQueryParameter("socialChat");
        if (id == null || (!"inbox".equals(id) && !id.matches("[0-9a-fA-F]{24}"))) return;

        String name = data.getQueryParameter("socialName");
        JSObject destination = new JSObject();
        destination.put("id", id);
        destination.put("name", name == null ? "" : name.substring(0, Math.min(name.length(), 80)));
        notifyListeners("destination", destination, true);
    }
}
