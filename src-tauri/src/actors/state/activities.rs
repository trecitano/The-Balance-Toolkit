use crate::file_system::ActivitiesFileSystem;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    id: String,
    title: String,
    static_image: String,
    sequence_images: Vec<String>,
    hover_images: Vec<String>,
    timeline_blocks: Vec<ActivityActionBlock>,
    boards_required: i32,
    description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityActionBlock {
    title: String,
    label: String,
    start: i32,
    duration: i32,
    image: Option<String>,
}

pub struct ActivityState {
    activities: Vec<Activity>,
}


impl ActivityState {
    pub fn new() -> Result<Self> {
        let activities = ActivitiesFileSystem::get_or_create_default_activities()?;

        Ok(Self {
            activities
        })
    }

    pub fn get_copy_of_activities(&self) -> Vec<Activity> {
        self.activities.clone()
    }

    pub fn get_copy_of_activity(&self, id: &str) -> Activity {
        self.activities.iter().find(|a| a.id == id).cloned().unwrap()
    }

    pub fn update_activity(&mut self, activity: Activity) -> Result<()> {
        let index = self.activities.iter().position(|a| a.id == activity.id).unwrap();
        self.activities[index] = activity;
        ActivitiesFileSystem::save_activities(&self.activities)?;
        Ok(())
    }

    pub fn reset_activity(&mut self, id: &str) -> Result<Activity> {
        let default_activities = Self::create_default_activities();
        let default_activity = default_activities.into_iter().find(|a| a.id == id).unwrap();
        let index = self.activities.iter().position(|a| a.id == id).unwrap();
        self.activities[index] = default_activity.clone();
        Ok(default_activity)
    }

    pub fn create_default_activities() -> Vec<Activity> {
        vec![
            // Quiet Standing
            Activity {
                id: "quiet-standing".into(),
                title: "Quiet standing (eyes-close + eyes-open)".into(),
                static_image: "quiet-standing-3-stand-eyes-open.svg".into(),
                sequence_images: vec![
                    "quiet-standing-3-stand-eyes-open.svg".into(),
                    "quiet-standing-4-stand-eyes-closed.svg".into(),
                ],
                hover_images: vec![
                    "activities-icon.svg".into(),
                    "light-icon.svg".into(),
                    "activities-icon.svg".into(),
                    "file-icon.svg".into(),
                    "settings-icon.svg".into(),
                    "wbb-icon-line.svg".into(),
                ],
                boards_required: 1,
                description: "Assess balance during quiet standing with eyes open and closed".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Stand - Eyes Open".into(), label: "stand-eyes-open".into(), start: 10, duration: 20, image: None },
                    ActivityActionBlock { title: "Stand - Eyes Closed".into(), label: "stand-eyes-closed".into(), start: 30, duration: 20, image: None },
                ],
            },
            // TUG
            Activity {
                id: "tug".into(),
                title: "Timed Up and Go (TUG)".into(),
                static_image: "tug-2-step-onto-board.svg".into(),
                sequence_images: vec![
                    "tug-3-stand-up.svg".into(),
                    "tug-4-walk-forward.svg".into(),
                    "tug-5-turn-around.svg".into(),
                    "tug-6-walk-back.svg".into(),
                    "tug-2-step-onto-board.svg".into(),
                ],
                hover_images: vec![
                    "book-icon.svg".into(),
                    "book-bookmark-icon.svg".into(),
                    "book-icon.svg".into(),
                ],
                boards_required: 1,
                description: "Evaluate mobility and fall risk".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Stand Up".into(), label: "stand-up".into(), start: 10, duration: 5, image: None },
                    ActivityActionBlock { title: "Walk Forward".into(), label: "walk-forward".into(), start: 15, duration: 10, image: None },
                    ActivityActionBlock { title: "Turn Around".into(), label: "turn-around".into(), start: 25, duration: 5, image: None },
                    ActivityActionBlock { title: "Walk Back".into(), label: "walk-back".into(), start: 30, duration: 10, image: None },
                    ActivityActionBlock { title: "Sit Down".into(), label: "sit-down".into(), start: 40, duration: 5, image: None },
                ],
            },
            // Single Leg Stance
            Activity {
                id: "single-leg-stance".into(),
                title: "Single leg stance".into(),
                static_image: "single-leg-stance-3-left-leg-up.svg".into(),
                sequence_images: vec![
                    "single-leg-stance-3-left-leg-up.svg".into(),
                    "single-leg-stance-4-stand-with-both-legs.svg".into(),
                    "single-leg-stance-5-right-leg-up.svg".into(),
                    "single-leg-stance-6-stand-with-both-legs.svg".into(),
                ],
                hover_images: vec![
                    "wbb-icon-line.svg".into(),
                    "balance-icon.svg".into(),
                    "wbb-icon-line.svg".into(),
                ],
                boards_required: 1,
                description: "Assess balance while standing on one leg".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Stand on One Leg".into(), label: "stand-on-one-leg".into(), start: 10, duration: 20, image: None },
                ],
            },
            // Tandem Stance
            Activity {
                id: "tandem-stance".into(),
                title: "Tandem stance".into(),
                static_image: "tandem-stance-3-left-leg-in-front.svg".into(),
                sequence_images: vec![
                    "tandem-stance-2-step-onto-board.svg".into(),
                    "tandem-stance-3-left-leg-in-front.svg".into(),
                    "tandem-stance-4-stand-with-both-legs.svg".into(),
                    "tandem-stance-5-right-leg-in-front.svg".into(),
                ],
                hover_images: vec![
                    "home-icon.svg".into(),
                    "light-icon.svg".into(),
                    "home-icon.svg".into(),
                ],
                boards_required: 1,
                description: "Assess balance with feet in tandem position".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Tandem Stand".into(), label: "tandem-stand".into(), start: 10, duration: 20, image: None },
                    ActivityActionBlock { title: "Return to Normal Stance".into(), label: "return-to-normal-stance".into(), start: 30, duration: 5, image: None },
                ],
            },
            // Functional Reach
            Activity {
                id: "functional-reach-test".into(),
                title: "Functional Reach Test".into(),
                static_image: "functional-reach-test-3-left-arm-reach.svg".into(),
                sequence_images: vec![
                    "functional-reach-test-3-left-arm-reach.svg".into(),
                    "functional-reach-test-2-left-arm-up.svg".into(),
                ],
                hover_images: vec![
                    "file-icon.svg".into(),
                    "settings-icon.svg".into(),
                    "file-icon.svg".into(),
                ],
                boards_required: 1,
                description: "Measure reaching capability while maintaining balance".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Reach Forward".into(), label: "reach-forward".into(), start: 10, duration: 10, image: None },
                    ActivityActionBlock { title: "Return to Start".into(), label: "return-to-start".into(), start: 20, duration: 5, image: None },
                ],
            },
            // Dynamic Weight Shifting
            Activity {
                id: "dynamic-weight-shifting".into(),
                title: "Dynamic weight shifting".into(),
                static_image: "dynamic-weight-shifting-3-lean-forward.svg".into(),
                sequence_images: vec![
                    "dynamic-weight-shifting-3-lean-forward.svg".into(),
                    "dynamic-weight-shifting-4-stand-upright.svg".into(),
                    "dynamic-weight-shifting-5-lean-backwards.svg".into(),
                    "dynamic-weight-shifting-6-lean-left.svg".into(),
                    "dynamic-weight-shifting-7-lean-right.svg".into(),
                ],
                hover_images: vec![
                    "activities-icon.svg".into(),
                    "session-icon.svg".into(),
                    "activities-icon.svg".into(),
                ],
                boards_required: 1,
                description: "Assess controlled weight shifting ability".into(),
                timeline_blocks: vec![
                    ActivityActionBlock { title: "Tare".into(), label: "tare".into(), start: 0, duration: 5, image: None },
                    ActivityActionBlock { title: "Step onto board".into(), label: "step-onto-board".into(), start: 5, duration: 5, image: None },
                    ActivityActionBlock { title: "Shift Weight".into(), label: "shift-weight".into(), start: 10, duration: 20, image: None },
                ],
            },
        ]
    }
}

