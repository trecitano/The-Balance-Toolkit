package com.balancetoolkit.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import com.balancetoolkit.data.local.entity.DeviceEntity
import com.balancetoolkit.data.local.entity.UserEntity

@Database(
    entities = [UserEntity::class, DeviceEntity::class],
    version = 3,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao

    abstract fun deviceDao(): DeviceDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                val db =
                    Room
                        .databaseBuilder(
                            context.applicationContext,
                            AppDatabase::class.java,
                            "balance_toolkit_database",
                        ).fallbackToDestructiveMigration(dropAllTables = true)
                        .build()
                instance = db
                db
            }
    }
}
