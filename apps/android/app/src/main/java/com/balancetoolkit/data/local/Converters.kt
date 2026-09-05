package com.balancetoolkit.data.local

import androidx.room.TypeConverter
import com.balancetoolkit.data.model.DominantHand
import com.balancetoolkit.data.model.Gender

class Converters {
    @TypeConverter
    fun fromGender(gender: Gender): String = gender.name

    @TypeConverter
    fun toGender(value: String): Gender = Gender.valueOf(value)

    @TypeConverter
    fun fromDominantHand(hand: DominantHand): String = hand.name

    @TypeConverter
    fun toDominantHand(value: String): DominantHand = DominantHand.valueOf(value)
}
