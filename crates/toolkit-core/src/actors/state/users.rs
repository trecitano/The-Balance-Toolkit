use crate::file_system::UserFileSystem;
use crate::types::User;
use anyhow::Result;
use chrono::Utc;
use rand::RngExt;
use std::sync::Arc;

pub struct UserState {
    users: Vec<Arc<User>>,
}

impl UserState {
    pub fn new() -> Result<Self> {
        let file_system_users = UserFileSystem::get_users()?;
        let mut users: Vec<Arc<User>> = file_system_users
            .clone()
            .into_iter()
            .map(Arc::new)
            .collect();

        // Create the default user is needed.
        if !file_system_users.iter().any(|u| u.is_default) {
            let default_user = User::default();
            users.push(Arc::new(default_user));
            UserFileSystem::save(&users)?;
        }

        Ok(Self { users })
    }

    pub fn get_default_user(&self) -> Arc<User> {
        self.users.iter().find(|u| u.is_default).unwrap().clone()
    }

    pub fn get_users(&self) -> Vec<Arc<User>> {
        self.users.clone()
    }

    pub fn get_user(&self, user_id: usize) -> Arc<User> {
        self.users
            .iter()
            .find(|user| user.id == user_id)
            .cloned()
            .unwrap()
    }

    pub fn create_user(&mut self) -> Result<Arc<User>> {
        let now = Utc::now();
        let user_id = create_new_unique_id(&self.users);
        let new_user = User {
            id: user_id,
            name: format!("New User {}", user_id),
            age: None,
            gender: None,
            height: None,
            height_metric: Some("cm".to_string()),
            weight: None,
            weight_metric: Some("kg".to_string()),
            dominant_hand: None,
            color: Some(format!("#{:06x}", rand::rng().random_range(0..=0xFFFFFF))),
            created_at: now,
            updated_at: now,
            is_default: false,
        };

        let user_reference = Arc::new(new_user.clone());

        self.users.push(user_reference.clone());
        self.save()?;

        Ok(user_reference)
    }

    pub fn update_user(&mut self, mut updated_user: User) -> Result<()> {
        self.users.retain(|user| user.id != updated_user.id);
        updated_user.updated_at = Utc::now();
        self.users.push(Arc::new(updated_user));

        self.save()
    }

    pub fn delete_user(&mut self, user_id: usize) -> Result<()> {
        self.users.retain(|user| user.id != user_id);

        self.save()
    }

    fn save(&self) -> Result<()> {
        UserFileSystem::save(&self.users)
    }
}

fn create_new_unique_id(users: &[Arc<User>]) -> usize {
    let mut base_number = users.len();

    loop {
        let candidate = format!("New User {}", base_number);
        let exists = users
            .iter()
            .any(|u| u.name == candidate || u.id == base_number);
        if !exists {
            return base_number;
        }
        base_number += 1;
    }
}
