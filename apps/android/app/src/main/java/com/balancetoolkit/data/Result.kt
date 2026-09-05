package com.balancetoolkit.data

sealed interface Result<out T> {
    data class Success<T>(
        val data: T,
    ) : Result<T>

    data class Error(
        val message: String,
        val cause: Throwable? = null,
    ) : Result<Nothing>
}

inline fun <T, R> Result<T>.map(transform: (T) -> R): Result<R> =
    when (this) {
        is Result.Success -> Result.Success(transform(data))
        is Result.Error -> this
    }

inline fun <T> Result<T>.onSuccess(action: (T) -> Unit): Result<T> {
    if (this is Result.Success) action(data)
    return this
}

inline fun <T> Result<T>.onError(action: (String, Throwable?) -> Unit): Result<T> {
    if (this is Result.Error) action(message, cause)
    return this
}

fun <T> Result<T>.getOrNull(): T? =
    when (this) {
        is Result.Success -> data
        is Result.Error -> null
    }

fun <T> Result<T>.getOrDefault(default: T): T =
    when (this) {
        is Result.Success -> data
        is Result.Error -> default
    }
