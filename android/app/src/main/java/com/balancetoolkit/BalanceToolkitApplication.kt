package com.balancetoolkit

import android.app.Application
import com.balancetoolkit.data.local.AppDatabase

class BalanceToolkitApplication : Application() {
    val database: AppDatabase by lazy { AppDatabase.getInstance(this) }
}
