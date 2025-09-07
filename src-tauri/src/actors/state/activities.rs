use std::string::ToString;
use crate::file_system::ActivitiesFileSystem;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub title: String,
    static_image: String,
    pub timeline_blocks: Vec<TimelineBlock>,
    boards_required: i32,
    description: String,
    pub loops: i32,
}

impl Activity {
    pub fn get_total_duration_ms(&self) -> i32 {
        let loop_duration: i32 = self.timeline_blocks.iter().map(|tb| tb.duration).sum();
        loop_duration * self.loops * 1000
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineBlock {
    title: String,
    pub id: String,
    pub duration: i32
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

    pub fn get_copy_of_activity(&self, id: &str) -> Option<Activity> {
        self.activities.iter().find(|a| a.id == id).cloned()
    }

    pub fn update_activity(&mut self, activity: Activity) -> Result<()> {
        println!("Updating activity: {:?}", activity);
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

    pub fn get_available_time_blocks(&self) -> Vec<TimelineBlock> {
        vec![
            eyes_close(),
            eyes_open(),
            lean_backwards(),
            lean_forward(),
            lean_to_the_left(),
            lean_to_the_right(),
            left_arm_down(),
            left_arm_reach(),
            left_arm_up(),
            left_foot_in_front(),
            left_leg_up(),
            right_arm_down(),
            right_arm_reach(),
            right_arm_up(),
            right_foot_in_front(),
            right_leg_up(),
            sit(),
            sit_again(),
            stand(),
            stand_on_board(),
            stand_on_board_reach(),
            stand_upright(),
            step_onto_board(),
            tare(),
            turn_around(),
            walk_back(),
            walk_forward(),
            dual_tare(),
            dual_step_on_the_boards(),
            dual_one_foot_on_each_board(),
            dual_squat_on_the_boards(),
            dual_stand_on_the_boards()
        ]
    }

    pub fn create_default_activities() -> Vec<Activity> {
        vec![
            // Eyes Open-close
            Activity {
                id: "eyes-open-close".into(),
                title: "Eyes open-close".into(),
                static_image: "eyes-open".into(),
                boards_required: 1,
                description: "Assess balance during quiet standing with eyes open and closed".into(),
                timeline_blocks: vec![
                    step_onto_board(), eyes_open(), eyes_close()
                ],
                loops: 2,
            },
            // Functional Reach
            Activity {
                id: "functional-reach-test".into(),
                title: "Functional Reach Test".into(),
                static_image: "left-arm-reach".into(),
                boards_required: 1,
                description: "Measure reaching capability while maintaining balance".into(),
                timeline_blocks: vec![
                    step_onto_board(), stand_on_board_reach(), left_arm_up(), left_arm_reach(),
                    left_arm_down(), right_arm_up(), right_arm_reach(), right_arm_down()
                ],
                loops: 2,
            },
            // Single Leg Stance
            Activity {
                id: "single-leg-stance".into(),
                title: "Single leg stance".into(),
                static_image: "left-leg-up".into(),
                boards_required: 1,
                description: "Assess balance while standing on one leg".into(),
                timeline_blocks: vec![
                    step_onto_board(), stand_on_board(), left_leg_up(), stand_on_board(), right_leg_up(), stand_on_board()
                ],
                loops: 2,
            },
            // Tandem Stance
            Activity {
                id: "tandem-stance".into(),
                title: "Tandem stance".into(),
                static_image: "left-foot-in-front".into(),
                boards_required: 1,
                description: "Assess balance with feet in tandem position".into(),
                timeline_blocks: vec![
                    step_onto_board(), stand_on_board(), left_foot_in_front(),
                    stand_on_board(), right_foot_in_front(), stand_on_board()
                ],
                loops: 2,
            },
            // TUG
            Activity {
                id: "tug".into(),
                title: "Timed Up and Go (TUG)".into(),
                static_image: "turn-around".into(),
                boards_required: 1,
                description: "Evaluate mobility and fall risk".into(),
                timeline_blocks: vec![
                    sit(), stand(), walk_forward(), turn_around(), walk_back(), sit_again()
                ],
                loops: 2,
            },
            // Squat on Two Boards
            Activity {
                id: "squat-two-boards".into(),
                title: "Squat on two boards".into(),
                static_image: "dual-board-squat-on-the-boards".into(),
                boards_required: 2,
                description: "Assess controlled weight shifting ability".into(),
                timeline_blocks: vec![
                    dual_step_on_the_boards(),
                    dual_one_foot_on_each_board(),
                    dual_squat_on_the_boards(),
                    dual_stand_on_the_boards()
                ],
                loops: 2,
            },
        ]
    }
}

fn eyes_close() -> TimelineBlock {
    TimelineBlock {
        title: "Eyes Closed".to_string(),
        id: "eyes-close".to_string(),
        duration: 4,
    }
}

fn eyes_open() -> TimelineBlock {
    TimelineBlock {
        title: "Eyes Open".to_string(),
        id: "eyes-open".to_string(),
        duration: 4,
    }
}

fn lean_backwards() -> TimelineBlock {
    TimelineBlock {
        title: "Lean Backwards".to_string(),
        id: "lean-backwards".to_string(),
        duration: 6,
    }
}

fn lean_forward() -> TimelineBlock {
    TimelineBlock {
        title: "Lean Forward".to_string(),
        id: "lean-forward".to_string(),
        duration: 6,
    }
}

fn lean_to_the_left() -> TimelineBlock {
    TimelineBlock {
        title: "Lean to the Left".to_string(),
        id: "lean-to-the-left".to_string(),
        duration: 6,
    }
}

fn lean_to_the_right() -> TimelineBlock {
    TimelineBlock {
        title: "Lean to the Right".to_string(),
        id: "lean-to-the-right".to_string(),
        duration: 8,
    }
}

fn left_arm_down() -> TimelineBlock {
    TimelineBlock {
        title: "Left Arm Down".to_string(),
        id: "left-arm-down".to_string(),
        duration: 8,
    }
}

fn left_arm_reach() -> TimelineBlock {
    TimelineBlock {
        title: "Left Arm Reach".to_string(),
        id: "left-arm-reach".to_string(),
        duration: 8,
    }
}

fn left_arm_up() -> TimelineBlock {
    TimelineBlock {
        title: "Left Arm Up".to_string(),
        id: "left-arm-up".to_string(),
        duration: 8,
    }
}

fn left_foot_in_front() -> TimelineBlock {
    TimelineBlock {
        title: "Left Foot in Front".to_string(),
        id: "left-foot-in-front".to_string(),
        duration: 8,
    }
}

fn left_leg_up() -> TimelineBlock {
    TimelineBlock {
        title: "Left Leg Up".to_string(),
        id: "left-leg-up".to_string(),
        duration: 8,
    }
}

fn right_arm_down() -> TimelineBlock {
    TimelineBlock {
        title: "Right Arm Down".to_string(),
        id: "right-arm-down".to_string(),
        duration: 8,
    }
}

fn right_arm_reach() -> TimelineBlock {
    TimelineBlock {
        title: "Right Arm Reach".to_string(),
        id: "right-arm-reach".to_string(),
        duration: 8,
    }
}

fn right_arm_up() -> TimelineBlock {
    TimelineBlock {
        title: "Right Arm Up".to_string(),
        id: "right-arm-up".to_string(),
        duration: 8,
    }
}

fn right_foot_in_front() -> TimelineBlock {
    TimelineBlock {
        title: "Right Foot in Front".to_string(),
        id: "right-foot-in-front".to_string(),
        duration: 8,
    }
}

fn right_leg_up() -> TimelineBlock {
    TimelineBlock {
        title: "Right Leg Up".to_string(),
        id: "right-leg-up".to_string(),
        duration: 8,
    }
}

fn sit() -> TimelineBlock {
    TimelineBlock {
        title: "Sit".to_string(),
        id: "sit".to_string(),
        duration: 12,
    }
}

fn sit_again() -> TimelineBlock {
    TimelineBlock {
        title: "Sit Again".to_string(),
        id: "sit-again".to_string(),
        duration: 12,
    }
}

fn stand() -> TimelineBlock {
    TimelineBlock {
        title: "Stand".to_string(),
        id: "stand".to_string(),
        duration: 12,
    }
}

fn stand_on_board() -> TimelineBlock {
    TimelineBlock {
        title: "Stand on the Board".to_string(),
        id: "stand-on-the-board".to_string(),
        duration: 12,
    }
}

fn stand_on_board_reach() -> TimelineBlock {
    TimelineBlock {
        title: "Stand on the Board (Reach)".to_string(),
        id: "stand-on-the-board-reach".to_string(),
        duration: 12,
    }
}

fn stand_upright() -> TimelineBlock {
    TimelineBlock {
        title: "Stand Upright".to_string(),
        id: "stand-upright".to_string(),
        duration: 12,
    }
}

fn step_onto_board() -> TimelineBlock {
    TimelineBlock {
        title: "Step onto Board".to_string(),
        id: "step-onto-board".to_string(),
        duration: 12,
    }
}

fn tare() -> TimelineBlock {
    TimelineBlock {
        title: "Tare".to_string(),
        id: "tare".to_string(),
        duration: 12,
    }
}

fn turn_around() -> TimelineBlock {
    TimelineBlock {
        title: "Turn Around".to_string(),
        id: "turn-around".to_string(),
        duration: 12,
    }
}

fn walk_back() -> TimelineBlock {
    TimelineBlock {
        title: "Walk Back".to_string(),
        id: "walk-back".to_string(),
        duration: 12,
    }
}

fn walk_forward() -> TimelineBlock {
    TimelineBlock {
        title: "Walk Forward".to_string(),
        id: "walk-forward".to_string(),
        duration: 12,
    }
}

fn dual_tare() -> TimelineBlock {
    TimelineBlock {
        title: "Step on the boards".to_string(),
        id: "dual-board-tare".to_string(),
        duration: 3,
    }
}

fn dual_step_on_the_boards() -> TimelineBlock {
    TimelineBlock {
        title: "Step on the boards".to_string(),
        id: "dual-board-step-on-the-boards".to_string(),
        duration: 3,
    }
}

fn dual_one_foot_on_each_board() -> TimelineBlock {
    TimelineBlock {
        title: "One foot on each board".to_string(),
        id: "dual-board-one-foot-on-each-board".to_string(),
        duration: 3,
    }
}

fn dual_squat_on_the_boards() -> TimelineBlock {
    TimelineBlock {
        title: "Squat on the boards".to_string(),
        id: "dual-board-squat-on-the-boards".to_string(),
        duration: 3,
    }
}

fn dual_stand_on_the_boards() -> TimelineBlock {
    TimelineBlock {
        title: "Stand on the boards".to_string(),
        id: "dual-board-stand-on-the-boards".to_string(),
        duration: 3,
    }
}