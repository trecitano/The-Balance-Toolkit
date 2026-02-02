package com.balancetoolkit.di

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.SharedPreferences
import com.balancetoolkit.bluetooth.BalanceBoardConnectionManager
import com.balancetoolkit.bluetooth.BalanceBoardConnectionManagerImpl
import com.balancetoolkit.bluetooth.BluetoothScanManager
import com.balancetoolkit.data.PreferenceKeys
import com.balancetoolkit.data.local.AppDatabase
import com.balancetoolkit.data.local.dao.DeviceDao
import com.balancetoolkit.data.local.dao.UserDao
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideBluetoothAdapter(
        @ApplicationContext context: Context,
    ): BluetoothAdapter? {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return bluetoothManager?.adapter
    }

    @Provides
    @Singleton
    fun provideBluetoothScanManager(
        @ApplicationContext context: Context,
        bluetoothAdapter: BluetoothAdapter?,
        sharedPreferences: SharedPreferences,
    ): BluetoothScanManager = BluetoothScanManager(context, bluetoothAdapter, sharedPreferences)

    @Provides
    @Singleton
    fun provideSharedPreferences(
        @ApplicationContext context: Context,
    ): SharedPreferences = context.getSharedPreferences(PreferenceKeys.PREFS_NAME, Context.MODE_PRIVATE)

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context,
    ): AppDatabase = AppDatabase.getInstance(context)

    @Provides
    @Singleton
    fun provideUserDao(database: AppDatabase): UserDao = database.userDao()

    @Provides
    @Singleton
    fun provideDeviceDao(database: AppDatabase): DeviceDao = database.deviceDao()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class BindingsModule {
    @Binds
    @Singleton
    abstract fun bindBalanceBoardConnectionManager(impl: BalanceBoardConnectionManagerImpl): BalanceBoardConnectionManager
}
