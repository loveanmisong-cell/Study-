export interface AndroidProjectFile {
  id: string;
  filename: string;
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'properties' | 'yaml' | 'markdown';
  summary: string;
  content: string;
}

export function getAndroidProjectFiles(): AndroidProjectFile[] {
  return [
    {
      id: 'main_activity',
      filename: 'MainActivity.kt',
      path: 'app/src/main/java/com/nova/ai/MainActivity.kt',
      language: 'kotlin',
      summary:
        'Full mobile app launcher & UI control, dynamic WhatsApp contact opener + auto-sender, notification listener setup for automatic replies, null-safe SpeechRecognizer, and OkHttp OpenAI Chat Completions.',
      content: `package com.nova.ai

import android.Manifest
import android.accessibilityservice.AccessibilityService
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {

    private lateinit var tts: TextToSpeech
    private var speechRecognizer: SpeechRecognizer? = null
    private lateinit var statusView: TextView
    private lateinit var logView: TextView
    private lateinit var voiceSpinner: Spinner
    private lateinit var confirmSwitch: Switch
    private lateinit var autoReplySwitch: Switch

    private val mainHandler = Handler(Looper.getMainLooper())
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val conversationHistory = mutableListOf<JSONObject>()
    private var pendingCommand: JSONObject? = null
    private var selectedVoiceMode = "hinglish_female"

    private var isListeningActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 84, 48, 48)
        }

        val title = TextView(this).apply {
            text = "NOVA AI MANAGER"
            textSize = 22f
        }

        statusView = TextView(this).apply {
            text = "Voice Listening: OFF. Tap Listening ON to start."
            textSize = 16f
            setPadding(0, 16, 0, 20)
        }

        voiceSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                listOf("Hindi + English Female", "Hindi Female", "English Female")
            )
        }

        confirmSwitch = Switch(this).apply {
            text = "Ask Permission Before Calling"
            isChecked = false
            setPadding(0, 16, 0, 12)
        }

        autoReplySwitch = Switch(this).apply {
            text = "WhatsApp AI Auto-Reply"
            isChecked = true
            setPadding(0, 8, 0, 20)
            setOnCheckedChangeListener { _, checked ->
                NovaWhatsAppReplyService.isAutoReplyEnabled = checked
            }
        }

        val listenToggleButton = Button(this).apply {
            text = "Voice Listening: OFF (Tap to Turn ON)"
            setOnClickListener {
                isListeningActive = !isListeningActive
                if (isListeningActive) {
                    text = "Voice Listening: ON (Tap to Turn OFF)"
                    startListening()
                } else {
                    text = "Voice Listening: OFF (Tap to Turn ON)"
                    speechRecognizer?.stopListening()
                    tts.stop()
                    statusView.text = "Voice Listening: OFF"
                }
            }
        }

        val accessibilityButton = Button(this).apply {
            text = "Enable Full App Accessibility Control"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        val notificationButton = Button(this).apply {
            text = "Enable WhatsApp Auto-Reply Listener"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }

        logView = TextView(this).apply {
            textSize = 14f
            setPadding(0, 24, 0, 0)
        }

        val scroll = ScrollView(this).apply { addView(logView) }

        root.addView(title)
        root.addView(statusView)
        root.addView(voiceSpinner)
        root.addView(confirmSwitch)
        root.addView(autoReplySwitch)
        root.addView(listenToggleButton)
        root.addView(accessibilityButton)
        root.addView(notificationButton)
        root.addView(scroll)
        setContentView(root)

        requestRuntimePermissions()
        tts = TextToSpeech(this, this)
        setupSpeechRecognizer()
    }

    private fun requestRuntimePermissions() {
        val needed = listOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_CONTACTS
        ).filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), 101)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            applyFemaleVoiceProfile()
            tts.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onError(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    if (isListeningActive) {
                        runOnUiThread { startListening() }
                    }
                }
            })
            speak("Namaste! Main NOVA hoon. Voice Listening ON karke bolein.")
        }
    }

    private fun applyFemaleVoiceProfile() {
        selectedVoiceMode = when (voiceSpinner.selectedItemPosition) {
            1 -> "hindi_female"
            2 -> "english_female"
            else -> "hinglish_female"
        }
        val locale = if (selectedVoiceMode == "english_female") Locale("en", "IN") else Locale("hi", "IN")
        tts.language = locale
        tts.setSpeechRate(1.02f)
        tts.setPitch(1.14f)
    }

    private fun setupSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            statusView.text = "Speech recognition unavailable on this device."
            return
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val spoken = list?.firstOrNull()?.trim().orEmpty()
                    if (spoken.isNotEmpty()) {
                        appendLog("You: $spoken")
                        handleUserQuery(spoken)
                    } else {
                        statusView.text = "Awaaz samajh nahi aayi. Dobara try karein."
                    }
                }

                override fun onError(error: Int) {
                    statusView.text = "Voice clear nahi thi (code $error). Dobara tap karein."
                }

                override fun onReadyForSpeech(params: Bundle?) {
                    statusView.text = "Listening (Hindi / English)..."
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() { statusView.text = "NOVA soch rahi hai..." }
                override fun onPartialResults(results: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    private fun startListening() {
        val recognizer = speechRecognizer ?: run {
            setupSpeechRecognizer()
            speechRecognizer
        } ?: return

        applyFemaleVoiceProfile()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (selectedVoiceMode == "english_female") "en-IN" else "hi-IN")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "hi-IN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 600L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 500L)
        }
        recognizer.startListening(intent)
    }

    private fun handleUserQuery(query: String) {
        val lower = query.lowercase(Locale.ROOT).trim()
        val service = NOVAAccessibilityService.instance

        // Instant zero-latency local execution for core navigation
        when {
            lower == "back" || lower == "back jao" || lower == "go back" -> {
                service?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
                return
            }
            lower == "home" || lower == "home kholo" || lower == "go home" -> {
                service?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
                return
            }
            lower == "scroll down" || lower == "neeche karo" -> {
                service?.scrollScreen(forward = true)
                return
            }
            lower == "scroll up" || lower == "upar karo" -> {
                service?.scrollScreen(forward = false)
                return
            }
        }

        val pending = pendingCommand
        if (pending != null) {
            if (lower.contains("haan") || lower.contains("yes") || lower.contains("kar do") || lower.contains("confirm")) {
                pendingCommand = null
                executeParsedAction(pending)
                return
            }
            if (lower.contains("nahi") || lower.contains("no") || lower.contains("cancel")) {
                pendingCommand = null
                speak("Theek hai, action cancel kar diya.")
                return
            }
        }
        sendQueryViaHelper(query)
    }

    private fun buildAiChatRequest(userQuery: String): Request? {
        val apiKey = BuildConfig.OPENAI_API_KEY
        if (apiKey.isBlank()) return null

        val systemPrompt = """
            You are NOVA, a fast, smart Hindi and English female AI mobile manager controlling ALL Android apps and WhatsApp.
            Respond strictly as JSON with keys:
            - reply (crisp natural female response in $selectedVoiceMode)
            - action (one of: none, open_app, click_ui_element, dial_call, type_text, draft_whatsapp, send_whatsapp, read_whatsapp, toggle_auto_reply, back, home, recents, scroll_down, scroll_up)
            - appName (ANY installed app name if action=open_app)
            - contactName (person name if user wants to open/message someone on WhatsApp)
            - phoneNumber (digits only, convert Hindi/English number words to digits)
            - textContent (text to type, button label to click, or WhatsApp message body)
            - needsConfirmation (boolean: true only for dial_call when confirmation enabled=\${confirmSwitch.isChecked})
        """.trimIndent()

        val messagesArray = JSONArray().apply {
            put(JSONObject().apply {
                put("role", "system")
                put("content", systemPrompt)
            })
            conversationHistory.takeLast(10).forEach { put(it) }
            put(JSONObject().apply {
                put("role", "user")
                put("content", userQuery)
            })
        }

        val requestJson = JSONObject().apply {
            put("model", "gpt-4o-mini")
            put("messages", messagesArray)
            put("response_format", JSONObject().put("type", "json_object"))
            put("temperature", 0.3)
        }

        val body = requestJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        return Request.Builder()
            .url("https://api.openai.com/v1/chat/completions")
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
    }

    private fun sendQueryViaHelper(userQuery: String) {
        val request = buildAiChatRequest(userQuery) ?: run {
            val msg = "API key BuildConfig mein configured nahi hai."
            statusView.text = msg
            speak(msg)
            return
        }

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    statusView.text = "Network error: \${e.localizedMessage ?: "Unknown"}"
                    speak("Internet connection check karein, server se connect nahi ho paaya.")
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val rawBody = response.body?.string().orEmpty()
                runOnUiThread {
                    if (!response.isSuccessful) {
                        statusView.text = "API Error (\${response.code})"
                        speak("API se response lene mein problem aayi.")
                        return@runOnUiThread
                    }
                    parseAndDispatchAiResponse(userQuery, rawBody)
                }
            }
        })
    }

    private fun parseAndDispatchAiResponse(userQuery: String, rawBody: String) {
        try {
            val root = JSONObject(rawBody)
            val contentStr = root
                .getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content")

            val parsed = JSONObject(contentStr)
            val reply = parsed.optString("reply", "Ho gaya.")

            conversationHistory.add(JSONObject().put("role", "user").put("content", userQuery))
            conversationHistory.add(JSONObject().put("role", "assistant").put("content", reply))

            statusView.text = "NOVA: $reply"
            appendLog("NOVA: $reply")
            speak(reply)

            if (parsed.optBoolean("needsConfirmation", false)) {
                pendingCommand = parsed
                showConfirmationDialog(parsed, reply)
            } else {
                executeParsedAction(parsed)
            }
        } catch (e: Exception) {
            statusView.text = "Parse error: \${e.localizedMessage ?: "Invalid JSON"}"
            speak("Response samajhne mein error aayi.")
        }
    }

    private fun showConfirmationDialog(cmd: JSONObject, prompt: String) {
        AlertDialog.Builder(this)
            .setTitle("NOVA Permission Request")
            .setMessage(prompt)
            .setPositiveButton("Allow") { _, _ ->
                pendingCommand = null
                executeParsedAction(cmd)
            }
            .setNegativeButton("Cancel") { _, _ ->
                pendingCommand = null
                speak("Theek hai, action cancel kar diya.")
            }
            .show()
    }

    private fun executeParsedAction(cmd: JSONObject) {
        val service = NOVAAccessibilityService.instance
        when (cmd.optString("action", "none")) {
            "open_app" -> openAnyAppByName(cmd.optString("appName"), cmd.optString("textContent"))
            "click_ui_element" -> {
                val label = cmd.optString("textContent")
                if (service == null || !service.clickNodeByText(label)) {
                    speak("Screen par $label button nahi mila.")
                }
            }
            "dial_call" -> dialOrCallTarget(cmd.optString("contactName"), cmd.optString("phoneNumber"))
            "type_text" -> {
                val value = cmd.optString("textContent")
                val targetApp = cmd.optString("appName")
                if (service == null) {
                    speak("Pehle Accessibility permission enable karein.")
                } else if (value.isNotBlank()) {
                    if (targetApp.isNotBlank()) {
                        openAnyAppByName(targetApp, value)
                    } else {
                        service.typeTextInFocusedField(value)
                    }
                }
            }
            "read_whatsapp", "draft_whatsapp", "send_whatsapp" -> {
                val contact = cmd.optString("contactName")
                val message = cmd.optString("textContent")
                val autoSend = cmd.optString("action") == "send_whatsapp"
                openWhatsAppByNameOrNumber(contact, cmd.optString("phoneNumber"), message, autoSend)
            }
            "toggle_auto_reply" -> {
                val next = !autoReplySwitch.isChecked
                autoReplySwitch.isChecked = next
                NovaWhatsAppReplyService.isAutoReplyEnabled = next
            }
            "back" -> service?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
            "home" -> service?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
            "recents" -> service?.performGlobalAction(AccessibilityService.GLOBAL_ACTION_RECENTS)
            "scroll_down" -> service?.scrollScreen(forward = true)
            "scroll_up" -> service?.scrollScreen(forward = false)
        }
    }

    private fun openAnyAppByName(name: String, searchQuery: String) {
        val target = name.lowercase(Locale.ROOT).trim()
        if (target == "youtube" && searchQuery.isNotBlank()) {
            val uri = Uri.parse("https://www.youtube.com/results?search_query=" + URLEncoder.encode(searchQuery, "UTF-8"))
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            return
        }
        val apps = packageManager.getInstalledApplications(0)
        val match = apps.firstOrNull {
            packageManager.getApplicationLabel(it).toString().lowercase(Locale.ROOT).contains(target)
        }
        val launchIntent = match?.let { packageManager.getLaunchIntentForPackage(it.packageName) }
        if (launchIntent != null) {
            startActivity(launchIntent)
            if (searchQuery.isNotBlank()) {
                mainHandler.postDelayed({
                    NOVAAccessibilityService.instance?.typeTextInFocusedField(searchQuery)
                }, 1200L)
            }
        } else {
            speak("$name app phone mein nahi mili.")
        }
    }

    private fun resolveContactPhoneNumber(contactName: String): String? {
        if (contactName.isBlank()) return null
        val hasReadContacts = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasReadContacts) return null

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )
        contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            "\${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
            arrayOf("%$contactName%"),
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                if (numberIndex >= 0) {
                    return cursor.getString(numberIndex)?.filter { it.isDigit() || it == '+' }
                }
            }
        }
        return null
    }

    private fun dialOrCallTarget(contactName: String, rawDigits: String) {
        var digits = rawDigits.filter { it.isDigit() || it == '+' }
        if (digits.isEmpty() && contactName.isNotBlank()) {
            digits = resolveContactPhoneNumber(contactName).orEmpty()
        }
        if (digits.isEmpty()) {
            if (contactName.isNotBlank()) {
                speak("$contactName ka number contacts mein nahi mila ya Contacts permission allow karein.")
            } else {
                speak("Naam ya number samajh nahi aaya, kripya dobara boliye.")
            }
            return
        }
        val hasCallPerm = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val action = if (hasCallPerm) Intent.ACTION_CALL else Intent.ACTION_DIAL
        startActivity(Intent(action, Uri.parse("tel:$digits")))
    }

    private fun openWhatsAppByNameOrNumber(
        contactName: String,
        phone: String,
        message: String,
        autoSend: Boolean
    ) {
        if (phone.isNotBlank()) {
            val encoded = URLEncoder.encode(message, "UTF-8")
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone?text=$encoded")))
            if (autoSend) {
                mainHandler.postDelayed({
                    NOVAAccessibilityService.instance?.clickWhatsAppSendButton()
                }, 1400L)
            }
            return
        }

        val waIntent = packageManager.getLaunchIntentForPackage("com.whatsapp")
        if (waIntent == null) {
            speak("Phone mein WhatsApp install nahi hai.")
            return
        }
        startActivity(waIntent)

        val service = NOVAAccessibilityService.instance
        if (service != null && contactName.isNotBlank()) {
            service.openWhatsAppContactAndMessage(contactName, message, autoSend)
        } else {
            speak("Pehle Accessibility permission enable karein taaki main $contactName ka chat khol sakun.")
        }
    }

    private fun speak(message: String) {
        tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "NOVA_TTS")
    }

    private fun appendLog(line: String) {
        logView.text = "\${logView.text}\\n$line".trim()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        speechRecognizer?.destroy()
        speechRecognizer = null
        tts.shutdown()
        super.onDestroy()
    }
}`,
    },
    {
      id: 'accessibility_service',
      filename: 'NOVAAccessibilityService.kt',
      path: 'app/src/main/java/com/nova/ai/NOVAAccessibilityService.kt',
      language: 'kotlin',
      summary:
        'Universal UI automation: taps any button by text/label across all apps, searches & opens any WhatsApp contact by name, types text, and taps Send automatically.',
      content: `package com.nova.ai

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Path
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class NOVAAccessibilityService : AccessibilityService() {

    companion object {
        var instance: NOVAAccessibilityService? = null
    }

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    fun typeTextInFocusedField(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val targetNode = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: findFirstEditableNode(root)
            ?: findSearchOrInputNode(root)
            ?: return false

        targetNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        targetNode.performAction(AccessibilityNodeInfo.ACTION_FOCUS)

        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        if (targetNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
            return true
        }

        // Clipboard fallback for apps that restrict direct ACTION_SET_TEXT (e.g. Compose/WebViews)
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        clipboard.setPrimaryClip(ClipData.newPlainText("NOVA_INPUT", text))
        return targetNode.performAction(AccessibilityNodeInfo.ACTION_PASTE)
    }

    private fun findSearchOrInputNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        val cls = node.className?.toString()?.lowercase().orEmpty()
        val hint = node.hintText?.toString()?.lowercase().orEmpty()
        val desc = node.contentDescription?.toString()?.lowercase().orEmpty()
        if (cls.contains("edittext") || cls.contains("autocomplete") ||
            hint.contains("search") || hint.contains("type") || hint.contains("message") ||
            desc.contains("search")
        ) {
            return node
        }
        for (i in 0 until node.childCount) {
            val found = findSearchOrInputNode(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    fun clickNodeByText(label: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val target = label.lowercase().trim()
        if (target.isEmpty()) return false

        val node = findClickableByTextOrDesc(root, target) ?: return false
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    fun openWhatsAppContactAndMessage(contactName: String, message: String, autoSend: Boolean) {
        handler.postDelayed({
            clickNodeByText("search")
            handler.postDelayed({
                typeTextInFocusedField(contactName)
                handler.postDelayed({
                    if (clickNodeByText(contactName) && message.isNotBlank()) {
                        handler.postDelayed({
                            typeTextInFocusedField(message)
                            if (autoSend) {
                                handler.postDelayed({ clickWhatsAppSendButton() }, 500L)
                            }
                        }, 800L)
                    }
                }, 900L)
            }, 600L)
        }, 1200L)
    }

    fun clickWhatsAppSendButton(): Boolean {
        val root = rootInActiveWindow ?: return false
        val byId = root.findAccessibilityNodeInfosByViewId("com.whatsapp:id/send")
            ?.firstOrNull { it.isClickable }
        if (byId != null) {
            return byId.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }

        val sendNode = findClickableByTextOrDesc(root, "send")
            ?: findClickableByTextOrDesc(root, "भेजें")
        return sendNode?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
    }

    private fun findClickableByTextOrDesc(node: AccessibilityNodeInfo?, query: String): AccessibilityNodeInfo? {
        if (node == null) return null
        val text = node.text?.toString()?.lowercase().orEmpty()
        val desc = node.contentDescription?.toString()?.lowercase().orEmpty()
        if (text.contains(query) || desc.contains(query)) {
            var current: AccessibilityNodeInfo? = node
            while (current != null) {
                if (current.isClickable) return current
                current = current.parent
            }
        }
        for (i in 0 until node.childCount) {
            val found = findClickableByTextOrDesc(node.getChild(i), query)
            if (found != null) return found
        }
        return null
    }

    private fun findFirstEditableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isFocusable) return node
        for (i in 0 until node.childCount) {
            val found = findFirstEditableNode(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    fun scrollScreen(forward: Boolean) {
        val metrics = resources.displayMetrics
        val centerX = metrics.widthPixels / 2f
        val startY = if (forward) metrics.heightPixels * 0.72f else metrics.heightPixels * 0.28f
        val endY = if (forward) metrics.heightPixels * 0.28f else metrics.heightPixels * 0.72f

        val swipePath = Path().apply {
            moveTo(centerX, startY)
            lineTo(centerX, endY)
        }

        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(swipePath, 0L, 280L))
            .build()

        dispatchGesture(gesture, null, null)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        instance = null
        super.onDestroy()
    }
}`,
    },
    {
      id: 'whatsapp_autoreply_service',
      filename: 'NovaWhatsAppReplyService.kt',
      path: 'app/src/main/java/com/nova/ai/NovaWhatsAppReplyService.kt',
      language: 'kotlin',
      summary:
        'Listens to incoming WhatsApp notifications, generates a contextual AI reply via OpenAI Chat Completions, and sends it back automatically through RemoteInput.',
      content: `package com.nova.ai

import android.app.Notification
import android.app.RemoteInput
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class NovaWhatsAppReplyService : NotificationListenerService() {

    companion object {
        @Volatile
        var isAutoReplyEnabled: Boolean = true
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (!isAutoReplyEnabled || sbn == null) return
        if (sbn.packageName != "com.whatsapp") return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return
        val sender = extras.getString(Notification.EXTRA_TITLE)?.trim().orEmpty()
        val incomingText = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()

        if (sender.isEmpty() || incomingText.isEmpty()) return

        val replyAction = findReplyAction(notification) ?: return
        generateAndSendAiReply(sender, incomingText, replyAction)
    }

    private fun findReplyAction(notification: Notification): Notification.Action? {
        return notification.actions?.firstOrNull { action ->
            action.remoteInputs?.isNotEmpty() == true
        }
    }

    private fun generateAndSendAiReply(
        sender: String,
        incomingText: String,
        replyAction: Notification.Action
    ) {
        val apiKey = BuildConfig.OPENAI_API_KEY
        if (apiKey.isBlank()) return

        val messages = JSONArray().apply {
            put(JSONObject().apply {
                put("role", "system")
                put("content", "You are replying to WhatsApp on behalf of the phone owner. Write a short, polite, natural reply (max 1-2 sentences) matching Hindi/Hinglish/English of the incoming message.")
            })
            put(JSONObject().apply {
                put("role", "user")
                put("content", "Sender: $sender\\nMessage: $incomingText")
            })
        }

        val payload = JSONObject().apply {
            put("model", "gpt-4o-mini")
            put("messages", messages)
            put("temperature", 0.5)
        }

        val request = Request.Builder()
            .url("https://api.openai.com/v1/chat/completions")
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                val bodyStr = response.body?.string().orEmpty()
                if (!response.isSuccessful) return
                try {
                    val replyText = JSONObject(bodyStr)
                        .getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .getString("content")
                        .trim()

                    if (replyText.isNotEmpty()) {
                        dispatchRemoteInputReply(replyAction, replyText)
                    }
                } catch (_: Exception) {}
            }
        })
    }

    private fun dispatchRemoteInputReply(action: Notification.Action, replyText: String) {
        val remoteInputs = action.remoteInputs ?: return
        val replyIntent = Intent()
        val bundle = Bundle()
        for (input in remoteInputs) {
            bundle.putCharSequence(input.resultKey, replyText)
        }
        RemoteInput.addResultsToIntent(remoteInputs, replyIntent, bundle)
        action.actionIntent.send(this, 0, replyIntent)
    }
}`,
    },
    {
      id: 'manifest',
      filename: 'AndroidManifest.xml',
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      summary:
        'Declares permissions and binds both NOVAAccessibilityService (all-app control) and NovaWhatsAppReplyService (incoming WhatsApp auto-reply).',
      content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission
        android:name="android.permission.QUERY_ALL_PACKAGES"
        tools:ignore="QueryAllPackagesPermission" />

    <application
        android:allowBackup="true"
        android:label="NOVA AI Manager"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".NOVAAccessibilityService"
            android:exported="true"
            android:label="NOVA AI Full Device Control"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_config" />
        </service>

        <service
            android:name=".NovaWhatsAppReplyService"
            android:exported="true"
            android:label="NOVA WhatsApp Auto-Reply"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
    },
    {
      id: 'accessibility_xml',
      filename: 'accessibility_config.xml',
      path: 'app/src/main/res/xml/accessibility_config.xml',
      language: 'xml',
      summary: 'Configures window content retrieval and gesture dispatch for NOVA AccessibilityService.',
      content: `<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackSpoken"
    android:accessibilityFlags="flagReportViewIds|flagRetrieveInteractiveWindows"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:description="@string/nova_accessibility_description"
    android:notificationTimeout="100" />`,
    },
    {
      id: 'build_gradle',
      filename: 'build.gradle.kts',
      path: 'app/build.gradle.kts',
      language: 'gradle',
      summary:
        'Adds OkHttp dependency and injects OPENAI_API_KEY from local.properties into BuildConfig safely.',
      content: `import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localProps = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.nova.ai"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nova.ai"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "3.0"

        val openAiKey = localProps.getProperty("OPENAI_API_KEY", "")
        buildConfigField("String", "OPENAI_API_KEY", "\\"$openAiKey\\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}`,
    },
    {
      id: 'strings_xml',
      filename: 'strings.xml',
      path: 'app/src/main/res/values/strings.xml',
      language: 'xml',
      summary: 'App name and Accessibility service description resources required for APK build.',
      content: `<resources>
    <string name="app_name">NOVA AI Manager</string>
    <string name="nova_accessibility_description">Allows NOVA AI Manager to open apps, type voice dictation into text fields, click UI elements, and send WhatsApp messages on your voice command.</string>
</resources>`,
    },
    {
      id: 'root_build_gradle',
      filename: 'build.gradle.kts (Root)',
      path: 'build.gradle.kts',
      language: 'gradle',
      summary: 'Root Android Gradle Plugin and Kotlin plugin versions for one-click APK compilation.',
      content: `plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}`,
    },
    {
      id: 'settings_gradle',
      filename: 'settings.gradle.kts',
      path: 'settings.gradle.kts',
      language: 'gradle',
      summary: 'Configures Google & Maven Central repositories and includes the :app module.',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "NOVA_AI_MANAGER"
include(":app")`,
    },
    {
      id: 'gradle_properties',
      filename: 'gradle.properties',
      path: 'gradle.properties',
      language: 'properties',
      summary: 'Standard AndroidX and Gradle JVM settings.',
      content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true`,
    },
    {
      id: 'github_apk_workflow',
      filename: 'build-apk.yml',
      path: '.github/workflows/build-apk.yml',
      language: 'yaml',
      summary: 'Cloud APK Builder: push this project to GitHub to automatically compile and download app-debug.apk without Android Studio.',
      content: `name: Build NOVA AI Manager APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Project
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Gradle 8.9
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.9'

      - name: Configure local.properties
        run: echo "OPENAI_API_KEY=\${{ secrets.OPENAI_API_KEY }}" > local.properties

      - name: Build Debug APK
        run: gradle assembleDebug --no-daemon

      - name: Upload NOVA-AI-Manager.apk
        uses: actions/upload-artifact@v4
        with:
          name: NOVA-AI-Manager-APK
          path: app/build/outputs/apk/debug/app-debug.apk`,
    },
    {
      id: 'local_properties',
      filename: 'local.properties.example',
      path: 'local.properties.example',
      language: 'properties',
      summary: 'Template for storing your API key outside version control.',
      content: `# Copy to local.properties (never commit real keys to git)
OPENAI_API_KEY=your_openai_api_key_here`,
    },
    {
      id: 'readme_apk',
      filename: 'README_BUILD_APK.md',
      path: 'README_BUILD_APK.md',
      language: 'markdown',
      summary: 'Step-by-step instructions to generate and install NOVA-AI-Manager.apk on your Android phone.',
      content: `# NOVA AI Manager — APK Build Guide

## Option 1: Build APK Without PC (GitHub Cloud APK)
1. Unzip \`NOVA-AI-Manager-APK-Kit.zip\`.
2. Create a free GitHub repository and upload all extracted files (including \`.github/workflows/build-apk.yml\`).
3. Optional: In GitHub repo **Settings > Secrets and variables > Actions**, add \`OPENAI_API_KEY\`.
4. Open the **Actions** tab and run **Build NOVA AI Manager APK**.
5. Download the **NOVA-AI-Manager-APK** artifact zip, extract \`app-debug.apk\`, and install it on your Android phone.

## Option 2: Build APK in Android Studio (PC / Mac)
1. Unzip \`NOVA-AI-Manager-APK-Kit.zip\` and open the folder in **Android Studio**.
2. Copy \`local.properties.example\` to \`local.properties\` and set \`OPENAI_API_KEY=...\`.
3. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. Transfer \`app/build/outputs/apk/debug/app-debug.apk\` to your phone and install.`,
    },
  ];
}
