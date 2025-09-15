# YOLOv8n Food Detection Model Setup

## Overview
This directory should contain the YOLOv8n model files for food detection. The app currently uses simulated detection for demo purposes, but can be configured to use a real YOLOv8n model.

## Setup Instructions

### 1. Install Ultralytics
```bash
pip install ultralytics
```

### 2. Train or Download a Food Detection Model

#### Option A: Use Pre-trained YOLOv8n (General Objects)
```python
from ultralytics import YOLO

# Load the pre-trained YOLOv8n model
model = YOLO("yolov8n.pt")

# Export to TensorFlow.js format
model.export(format="tfjs")
```

#### Option B: Train Custom Food Detection Model
```python
from ultralytics import YOLO

# Load a pre-trained model
model = YOLO("yolov8n.pt")

# Train on food dataset (e.g., Food-101, Open Images Food subset)
model.train(
    data="path/to/food_dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=16
)

# Export trained model to TensorFlow.js
model.export(format="tfjs")
```

### 3. Deploy Model Files
After export, copy the generated `yolov8n_web_model` folder to this directory:
```
/client/public/models/
├── yolov8n_web_model/
│   ├── model.json
│   ├── group1-shard1of2.bin
│   ├── group1-shard2of2.bin
│   └── ...
```

### 4. Update foodDetection.ts
Replace the simulated loading with actual model loading:

```typescript
// In loadModel() function, replace:
model = {} as tf.GraphModel;

// With:
model = await tf.loadGraphModel('/models/yolov8n_web_model/model.json');
```

### 5. Update Class Mappings
If using a custom food-trained model, update the `YOLO_TO_FOOD_MAPPING` object in `/client/src/lib/foodDetection.ts` to match your model's classes.

## Model Performance

### YOLOv8n Specifications
- **Size**: ~6.3 MB (TensorFlow.js format ~13 MB)
- **Speed**: ~100 FPS on GPU, ~10-30 FPS in browser (WebGL)
- **mAP**: 37.3 on COCO dataset
- **Parameters**: 3.2M
- **Input Size**: 640x640 pixels

### Optimization Tips
1. Use WebGL backend for best performance
2. Consider WebGPU for newer browsers
3. Implement model quantization (INT8) for smaller size
4. Use Web Workers to prevent UI blocking
5. Cache model in IndexedDB for faster subsequent loads

## Food Datasets for Training

### Recommended Datasets
1. **Food-101**: 101 food categories, 101,000 images
2. **Open Images V7 (Food Subset)**: Various food items with bounding boxes
3. **Nutrition5k**: 5k dishes with nutrition labels
4. **Recipe1M+**: 1M+ recipes with images
5. **Food Recognition Benchmark**: 100k+ food images

### Custom Dataset Format
Create a YAML file for training:
```yaml
path: ../datasets/food-detection
train: images/train
val: images/val
test: images/test

nc: 80  # number of classes
names: ['pizza', 'burger', 'salad', 'pasta', ...]  # class names
```

## Troubleshooting

### Model Not Loading
- Check browser console for errors
- Verify model files are accessible at `/models/yolov8n_web_model/`
- Ensure CORS headers are properly configured

### Poor Detection Accuracy
- Train on more diverse food images
- Adjust confidence threshold (default: 0.25)
- Fine-tune IOU threshold (default: 0.45)
- Consider using YOLOv8s or YOLOv8m for better accuracy

### Performance Issues
- Reduce input image size (e.g., 416x416 instead of 640x640)
- Enable GPU acceleration in browser settings
- Use model quantization
- Implement detection throttling/debouncing

## Additional Resources
- [Ultralytics YOLOv8 Docs](https://docs.ultralytics.com/)
- [TensorFlow.js Guide](https://www.tensorflow.org/js/guide)
- [Food-101 Dataset](https://www.vision.ee.ethz.ch/datasets_extra/food-101/)
- [YOLOv8 TF.js Export](https://docs.ultralytics.com/integrations/tfjs/)