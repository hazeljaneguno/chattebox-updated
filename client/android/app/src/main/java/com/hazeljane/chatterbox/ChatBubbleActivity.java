package com.hazeljane.chatterbox;

import android.content.Intent;
import android.os.Bundle;
import org.json.JSONObject;

import com.getcapacitor.BridgeActivity;

public class ChatBubbleActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forwardChatIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardChatIntent(intent);
    }

    private void forwardChatIntent(Intent intent) {
        if (intent == null) return;

        String type = intent.getStringExtra("type");
        String conversationId =
                intent.getStringExtra("conversationId");
        String groupId =
                intent.getStringExtra("groupId");
        String senderId =
                intent.getStringExtra("senderId");

        if (type == null || type.isEmpty()) return;

        // Save pending navigation for cold starts.
        getPreferences(MODE_PRIVATE)
                .edit()
                .putString("pendingBubbleType", type)
                .putString(
                        "pendingBubbleConversationId",
                        conversationId
                )
                .putString("pendingBubbleGroupId", groupId)
                .putString("pendingBubbleSenderId", senderId)
                .apply();

        try {
            JSONObject data = new JSONObject();

            data.put("type", type);
            data.put("conversationId", conversationId);
            data.put("groupId", groupId);
            data.put("senderId", senderId);

            if (getBridge() != null) {
                getBridge().triggerWindowJSEvent(
                        "chatterboxBubbleOpened",
                        data.toString()
                );
            }

        } catch (Exception error) {
            android.util.Log.e(
                    "ChatterboxBubble",
                    "Failed to forward bubble intent",
                    error
            );
        }
    }
}
