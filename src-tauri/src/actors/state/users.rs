use crate::file_system::UserFileSystem;
use crate::types::User;
use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;

pub struct UserState {
    users: Vec<Arc<User>>,
}

impl UserState {
    pub fn new() -> Result<Self> {
        let file_system_users = UserFileSystem::get_users()?;
        let mut users: Vec<Arc<User>> = file_system_users.clone().into_iter().map(Arc::new).collect();

        // Create the default user is needed.
        if !file_system_users.iter().any(|u| u.is_default) {
            let default_user = User::default();
            users.push(Arc::new(default_user));
            UserFileSystem::save(&users)?;
        }

        Ok(Self {
            users
        })
    }

    pub fn get_default_user(&self) -> Arc<User> {
        self.users.iter().find(|u| u.is_default).unwrap().clone()
    }

    pub fn get_users(&self) -> Vec<Arc<User>> {
        self.users.clone()
    }

    pub fn get_user(&self, user_name: &str) -> Arc<User> {
        self.users.iter().find(|user| user.name == user_name).cloned().unwrap()
    }

    pub fn create_user(&mut self, user: User) -> Result<()> {
        self.users.push(Arc::new(user));

        self.save()
    }

    pub fn update_user(&mut self, mut updated_user: User) -> Result<()> {
        self.users.retain(|user| user.name != updated_user.name);
        updated_user.updated_at = Utc::now();
        self.users.push(Arc::new(updated_user));

        self.save()
    }

    pub fn delete_user(&mut self, user_name: &str) -> Result<()> {
        self.users.retain(|user| user.name != user_name);

        self.save()
    }

    fn save(&self) -> Result<()> {
        UserFileSystem::save(&self.users)
    }
}

