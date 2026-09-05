package com.balancetoolkit.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender
import com.balancetoolkit.data.model.User
import com.balancetoolkit.data.model.getAvatarColors
import java.util.UUID

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val age: Int = 25,
    val gender: Gender = Gender.MALE,
    val height: Int = 170,
    val weight: Int = 70,
    val dominantHand: DominantHand = DominantHand.RIGHT,
    val color: String = "#3B82F6",
    val updatedAt: String = "",
)

fun UserEntity.toUser(): User {
    val (bgColor, iconColor) = getAvatarColors(color)
    return User(
        id = id,
        name = name,
        age = age,
        gender = gender,
        height = height,
        weight = weight,
        dominantHand = dominantHand,
        color = color,
        updatedAt = updatedAt,
        avatarBackgroundColor = bgColor,
        avatarIconColor = iconColor,
    )
}

fun User.toEntity(): UserEntity =
    UserEntity(
        id = id,
        name = name,
        age = age,
        gender = gender,
        height = height,
        weight = weight,
        dominantHand = dominantHand,
        color = color,
        updatedAt = updatedAt,
    )
