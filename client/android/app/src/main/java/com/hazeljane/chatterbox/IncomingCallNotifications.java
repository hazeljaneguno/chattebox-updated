package com.hazeljane.chatterbox;
import android.app.*;
import android.content.*;
import android.os.Build;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public final class IncomingCallNotifications {
  public static final String CHANNEL_ID = "chatterbox_incoming_calls";
  public static final String ACTION_OPEN = "com.hazeljane.chatterbox.OPEN_INCOMING_CALL";
  public static final String ACTION_ANSWER = "com.hazeljane.chatterbox.ANSWER_CALL";
  public static final String ACTION_DECLINE = "com.hazeljane.chatterbox.DECLINE_CALL";
  public static final String EXTRA_CALL_ID = "callId", EXTRA_CALLER_NAME = "callerName", EXTRA_CALL_TYPE = "callType", EXTRA_CALL_ACTION = "callAction";
  private static int id(String callId) { return callId.hashCode() & 0x7fffffff; }
  public static void createChannel(Context context) {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationManager nm = context.getSystemService(NotificationManager.class);
      NotificationChannel incoming = new NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
      incoming.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE), new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
      incoming.enableVibration(true);
      nm.createNotificationChannel(incoming);
      nm.createNotificationChannel(new NotificationChannel("chatterbox_ongoing_calls", "Join group calls", NotificationManager.IMPORTANCE_LOW));
    }
  }
  private static PendingIntent action(Context c, Map<String,String> data, String action, boolean receiver) {
    Intent i = new Intent(c, receiver ? IncomingCallReceiver.class : MainActivity.class);
    i.setAction(action);
    i.setData(Uri.parse("chatterbox://call/" + data.get("callId") + "/" + action));
    for (Map.Entry<String,String> entry : data.entrySet()) i.putExtra(entry.getKey(),entry.getValue());
    i.putExtra(EXTRA_CALL_ACTION, action);
    i.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    return receiver ? PendingIntent.getBroadcast(c,0,i,flags) : PendingIntent.getActivity(c,0,i,flags);
  }
  public static void show(Context c, RemoteMessage message) {
    Map<String,String> data = message.getData();
    String callId = data.get("callId");
    if (callId == null) return;
    if ("call_ended".equals(data.get("type")) || "ended".equals(data.get("action"))) { dismiss(c,callId); return; }
    long remaining = 45000;
    try { if (data.containsKey("expiresAt")) remaining = java.time.Instant.parse(data.get("expiresAt")).toEpochMilli() - System.currentTimeMillis(); }
    catch (Exception e) { return; }
    if (remaining <= 0) return;
    boolean join = "join".equals(data.get("action"));
    boolean group = "group_call".equals(data.get("type"));
    createChannel(c);
    NotificationCompat.Builder n = new NotificationCompat.Builder(c, join ? "chatterbox_ongoing_calls" : CHANNEL_ID)
      .setSmallIcon(android.R.drawable.sym_action_call)
      .setContentTitle(group ? data.get("groupName") : data.get("callerName"))
      .setContentText(join ? "Group call ongoing — tap to join" : "Incoming " + data.get("callType") + " call")
      .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(join ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true)
      .setOngoing(join).setAutoCancel(!join).setTimeoutAfter(join ? Math.min(remaining,3600000) : Math.min(remaining,45000))
      .setContentIntent(action(c,data,join ? ACTION_ANSWER : ACTION_OPEN,false))
      .addAction(android.R.drawable.sym_action_call,join ? "Join Call" : "Answer",action(c,data,ACTION_ANSWER,false));
    if (!join) n.addAction(android.R.drawable.ic_menu_close_clear_cancel,"Decline",action(c,data,ACTION_DECLINE,true));
    try { NotificationManagerCompat.from(c).notify(id(callId),n.build()); }
    catch (SecurityException e) { android.util.Log.w("ChatterboxCalls","Notification permission missing"); }
  }
  public static void dismiss(Context c,String callId) { if (callId != null) NotificationManagerCompat.from(c).cancel(id(callId)); }
}
