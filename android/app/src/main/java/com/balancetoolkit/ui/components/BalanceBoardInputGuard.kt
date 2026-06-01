package com.balancetoolkit.ui.components

import android.util.Log
import android.view.InputDevice
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.onPreviewKeyEvent

// Nintendo Bluetooth/USB vendor ID; the Balance Board and Wii Remote both report it.
private const val NINTENDO_VENDOR_ID = 0x057E
private const val TAG = "BalanceBoardInput"

/**
 * The Wii Balance Board connects over the system Bluetooth HID host, so Android also enumerates it
 * as a generic HID input device and injects its continuous sensor reports as D-pad/axis events.
 * Those events hijack focus (e.g. moving the cursor in text fields). The app only consumes the
 * board as a weight sensor, so any input events it generates are spurious and should be dropped.
 */
internal fun isBalanceBoardInput(device: InputDevice?): Boolean {
    if (device == null) return false
    if (device.vendorId == NINTENDO_VENDOR_ID) return true
    val name = device.name
    return name.contains("Balance Board", ignoreCase = true) ||
        name.contains("RVL-WBC", ignoreCase = true)
}

/**
 * Swallows Balance Board key events for the focus subtree this modifier is attached to. Activity-
 * level interception in `MainActivity` only covers the Activity's window; Compose dialogs run in
 * their own window, so apply this to a dialog's root content to filter the board there too. A
 * preview handler on an ancestor runs before the focused text field processes the key, so the
 * spurious D-pad events never reach the caret. Logs each previewed key (temporary diagnostics).
 */
fun Modifier.blockBalanceBoardInput(): Modifier =
    onPreviewKeyEvent { keyEvent ->
        val device = keyEvent.nativeKeyEvent.device
        val blocked = isBalanceBoardInput(device)
        val info = "code=${keyEvent.nativeKeyEvent.keyCode} device='${device?.name}' vendor=${device?.vendorId}"
        Log.d(TAG, "preview key $info blocked=$blocked")
        blocked
    }
