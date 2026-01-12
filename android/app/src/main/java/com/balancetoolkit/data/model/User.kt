package com.balancetoolkit.data.model

import androidx.compose.ui.graphics.Color
import com.balancetoolkit.ui.theme.AvatarBlue
import com.balancetoolkit.ui.theme.AvatarBlueLight
import com.balancetoolkit.ui.theme.AvatarRed
import com.balancetoolkit.ui.theme.AvatarRedLight
import com.balancetoolkit.ui.theme.AvatarYellow
import com.balancetoolkit.ui.theme.AvatarYellowLight
import java.util.UUID

/**
 * Maps a hex color string to avatar background and icon colors.
 * Returns a Pair of (backgroundColor, iconColor).
 */
fun getAvatarColors(hexColor: String): Pair<Color, Color> =
    when {
        hexColor.contains("E53935", ignoreCase = true) ||
            hexColor.contains("F44336", ignoreCase = true) ||
            hexColor.contains("EF5350", ignoreCase = true) -> AvatarRedLight to AvatarRed

        hexColor.contains("FBC02D", ignoreCase = true) ||
            hexColor.contains("FFEB3B", ignoreCase = true) ||
            hexColor.contains("FFC107", ignoreCase = true) -> AvatarYellowLight to AvatarYellow

        else -> AvatarBlueLight to AvatarBlue
    }

data class User(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val age: Int = 25,
    val gender: Gender = Gender.MALE,
    val height: Int = 170,
    val weight: Int = 70,
    val dominantHand: DominantHand = DominantHand.RIGHT,
    val color: String = "#3B82F6",
    val notes: String = "",
    val updatedAt: String = "",
    val avatarBackgroundColor: Color = AvatarBlueLight,
    val avatarIconColor: Color = AvatarBlue,
)

enum class Gender {
    MALE,
    FEMALE,
    OTHER,
    ;

    override fun toString(): String =
        when (this) {
            MALE -> "Male"
            FEMALE -> "Female"
            OTHER -> "Other"
        }

    companion object {
        fun fromString(value: String): Gender =
            when (value.lowercase()) {
                "male" -> MALE
                "female" -> FEMALE
                else -> OTHER
            }
    }
}

enum class DominantHand {
    LEFT,
    RIGHT,
    ;

    override fun toString(): String =
        when (this) {
            LEFT -> "Left"
            RIGHT -> "Right"
        }

    companion object {
        fun fromString(value: String): DominantHand =
            when (value.lowercase()) {
                "left" -> LEFT
                else -> RIGHT
            }
    }
}
